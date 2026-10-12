import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;

public class SpellChecker {
    private static final int PORT = Integer.getInteger("port", 8080);
    private static final Path DATA = Paths.get("data");
    private static final Path USERS = DATA.resolve("users.tsv");
    private static final Path HISTORY = DATA.resolve("history.tsv");
    private static final Set<String> dictionary = ConcurrentHashMap.newKeySet();
    private static final Map<String, Session> sessions = new ConcurrentHashMap<>();
    private static final SecureRandom random = new SecureRandom();
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneOffset.UTC);

    public static void main(String[] args) throws Exception {
        Files.createDirectories(DATA);
        loadDictionary();
        ensureAdmin();
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.setExecutor(Executors.newCachedThreadPool());
        server.createContext("/api/", SpellChecker::api);
        server.createContext("/", SpellChecker::website);
        System.out.println("================================================");
        System.out.println("             INTELLICHECK SPELL CHECKER");
        System.out.println("================================================");
        System.out.println("Dictionary words: " + dictionary.size());
        System.out.println("Admin login: admin@intellicheck.com");
        System.out.println("Admin password: Admin@12345");
        System.out.println("Open http://localhost:" + PORT);
        System.out.println("Keep this terminal open while using the website.");
        System.out.println("================================================");
        server.start();
    }

    private static void loadDictionary() throws IOException {
        Path file = Paths.get("dictionary.txt");
        if (Files.exists(file)) for (String line : Files.readAllLines(file)) {
            String w = line.trim().toLowerCase(Locale.ROOT);
            if (!w.isEmpty()) dictionary.add(w);
        }
        dictionary.addAll(Arrays.asList(("a about above after again all also am an and another any are around as at back be because been before being between both but by can come could day did different do does done down each even every find first for from get give go good great had has have he her here him his how i if in into is it its just know large last learn like little long look made make many may me more most much my new no not now of off on one only or other our out over people place put right said same see she should show small so some something still such take than that the their them then there these they thing think this those through time to too two under up us use very want was way we well were what when where which while who will with word work would write you your algorithm application artificial computer correction data database dictionary distance dynamic editing efficient error intelligent language levenshtein minimum natural processing project program search similarity spell spelling string suggestion system technology text user website receive message friend tomorrow beautiful necessary separate definitely successful environment development experience important information available beginning business college knowledge library student teacher university programming software engineering science hello world simple checker").split("\\s+")));
    }

    private static void ensureAdmin() throws Exception {
        if (Files.exists(USERS) && Files.readAllLines(USERS).stream().anyMatch(s -> s.startsWith("Administrator\tadmin@intellicheck.com\t"))) return;
        String salt = randomHex(16);
        String hash = hashPassword("Admin@12345", salt);
        String line = "Administrator\tadmin@intellicheck.com\t" + salt + "\t" + hash + "\tADMIN\t" + TIME.format(Instant.now()) + System.lineSeparator();
        Files.writeString(USERS, line, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
    }

    private static void api(HttpExchange ex) throws IOException {
        setCorsAndHeaders(ex);
        String path = ex.getRequestURI().getPath();
        try {
            if (path.equals("/api/register") && ex.getRequestMethod().equals("POST")) { register(ex); return; }
            if (path.equals("/api/login") && ex.getRequestMethod().equals("POST")) { login(ex); return; }
            if (path.equals("/api/logout") && ex.getRequestMethod().equals("POST")) { logout(ex); return; }
            Session session = getSession(ex);
            if (path.equals("/api/me") && ex.getRequestMethod().equals("GET")) {
                if (session == null) { json(ex, 401, "{\"error\":\"Please log in.\"}"); return; }
                json(ex, 200, "{\"user\":" + userJson(session.user) + "}"); return;
            }
            if (session == null) { json(ex, 401, "{\"error\":\"Please log in first.\"}"); return; }
            if (path.equals("/api/check") && ex.getRequestMethod().equals("POST")) { check(ex, session); return; }
            if (path.equals("/api/history") && ex.getRequestMethod().equals("GET")) { history(ex, session); return; }
            if (path.equals("/api/admin/overview") && ex.getRequestMethod().equals("GET")) {
                if (!session.user.role.equals("ADMIN")) { json(ex,403,"{\"error\":\"Administrator access required.\"}"); return; }
                adminOverview(ex); return;
            }
            json(ex, 404, "{\"error\":\"API endpoint not found.\"}");
        } catch (Exception e) {
            e.printStackTrace();
            json(ex, 500, "{\"error\":\"Server error. Please try again.\"}");
        }
    }

    private static void register(HttpExchange ex) throws Exception {
        Map<String,String> f = form(ex);
        String name = f.getOrDefault("name","").trim();
        String email = f.getOrDefault("email","").trim().toLowerCase(Locale.ROOT);
        String password = f.getOrDefault("password","");
        if (name.length() < 2 || name.length() > 60 || !email.matches("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$") || password.length() < 8) {
            json(ex,400,"{\"error\":\"Enter a name, valid email, and password with at least 8 characters.\"}"); return;
        }
        synchronized (USERS.toString().intern()) {
            if (findUser(email) != null) { json(ex,409,"{\"error\":\"An account with this email already exists.\"}"); return; }
            String salt = randomHex(16), hash = hashPassword(password,salt);
            Files.writeString(USERS, safe(name)+"\t"+email+"\t"+salt+"\t"+hash+"\tCUSTOMER\t"+TIME.format(Instant.now())+System.lineSeparator(), StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        }
        User user = findUser(email);
        createSession(ex,user);
        json(ex,200,"{\"ok\":true,\"user\":"+userJson(user)+"}");
    }

    private static void login(HttpExchange ex) throws Exception {
        Map<String,String> f = form(ex);
        String email = f.getOrDefault("email","").trim().toLowerCase(Locale.ROOT);
        String password = f.getOrDefault("password","");
        User u = findUser(email);
        if (u == null || !MessageDigest.isEqual(hashPassword(password,u.salt).getBytes(StandardCharsets.UTF_8),u.hash.getBytes(StandardCharsets.UTF_8))) {
            json(ex,401,"{\"error\":\"Email or password is incorrect.\"}"); return;
        }
        createSession(ex,u);
        json(ex,200,"{\"ok\":true,\"user\":"+userJson(u)+"}");
    }

    private static void logout(HttpExchange ex) throws IOException {
        String token = cookie(ex,"IC_SESSION");
        if (token != null) sessions.remove(token);
        ex.getResponseHeaders().add("Set-Cookie","IC_SESSION=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
        json(ex,200,"{\"ok\":true}");
    }

    private static void check(HttpExchange ex, Session session) throws Exception {
        Map<String,String> f = form(ex);
        String text = f.getOrDefault("text","").trim();
        if (text.isEmpty()) { json(ex,400,"{\"error\":\"Enter some text to check.\"}"); return; }
        if (text.length() > 12000) { json(ex,400,"{\"error\":\"Please keep text under 12,000 characters.\"}"); return; }
        List<String> words = extractWords(text);
        List<Map<String,Object>> errors = new ArrayList<>();
        for (String word : words) {
            String lower = word.toLowerCase(Locale.ROOT);
            if (dictionary.contains(lower)) continue;
            List<Suggestion> suggestions = suggestions(lower);
            if (!suggestions.isEmpty()) {
                Map<String,Object> item = new LinkedHashMap<>();
                item.put("word",word);
                List<Map<String,Object>> choices = new ArrayList<>();
                for (Suggestion s : suggestions) { Map<String,Object> choice = new LinkedHashMap<>(); choice.put("word",s.word); choice.put("distance",s.distance); choices.add(choice); }
                item.put("suggestions",choices); errors.add(item);
            }
        }
        String jsonErrors = jsonValue(errors);
        String id = UUID.randomUUID().toString();
        String stamp = TIME.format(Instant.now());
        String summary = errors.size()+" spelling issue(s)";
        String historyLine = safe(id)+"\t"+safe(session.user.email)+"\t"+safe(stamp)+"\t"+safe(summary)+"\t"+words.size()+System.lineSeparator();
        Files.writeString(HISTORY,historyLine,StandardCharsets.UTF_8,StandardOpenOption.CREATE,StandardOpenOption.APPEND);
        json(ex,200,"{\"errors\":"+jsonErrors+",\"checkedWords\":"+words.size()+",\"dictionarySize\":"+dictionary.size()+"}");
    }

    private static void history(HttpExchange ex, Session session) throws IOException {
        List<String> rows = new ArrayList<>();
        if (Files.exists(HISTORY)) {
            List<String> lines = Files.readAllLines(HISTORY);
            Collections.reverse(lines);
            for (String line : lines) {
                String[] p = line.split("\t",-1);
                if (p.length >= 5 && (session.user.role.equals("ADMIN") || p[1].equals(session.user.email))) {
                    rows.add("{\"time\":"+q(p[2])+",\"summary\":"+q(p[3])+",\"words\":"+p[4]+"}");
                    if (rows.size() >= 50) break;
                }
            }
        }
        json(ex,200,"{\"items\":["+String.join(",",rows)+"]}");
    }

    private static void adminOverview(HttpExchange ex) throws IOException {
        List<User> all = readUsers();
        int customers = (int)all.stream().filter(u -> u.role.equals("CUSTOMER")).count();
        long checks = Files.exists(HISTORY) ? Files.lines(HISTORY).count() : 0;
        List<String> recent = new ArrayList<>();
        if (Files.exists(HISTORY)) {
            List<String> lines = Files.readAllLines(HISTORY); Collections.reverse(lines);
            for (String line : lines) {
                String[] p=line.split("\t",-1);
                if(p.length>=5) recent.add("{\"email\":"+q(p[1])+",\"time\":"+q(p[2])+",\"summary\":"+q(p[3])+",\"words\":"+p[4]+"}");
                if(recent.size()>=10) break;
            }
        }
        List<String> userJson = new ArrayList<>();
        for (User u:all) userJson.add("{\"name\":"+q(u.name)+",\"email\":"+q(u.email)+",\"role\":"+q(u.role)+",\"created\":"+q(u.created)+"}");
        json(ex,200,"{\"stats\":{\"users\":"+customers+",\"checks\":"+checks+",\"dictionary\":"+dictionary.size()+"},\"users\":["+String.join(",",userJson)+"],\"recent\":["+String.join(",",recent)+"]}");
    }

    private static List<Suggestion> suggestions(String word) {
        List<Suggestion> out = new ArrayList<>();
        for (String dw : dictionary) {
            if (Math.abs(word.length()-dw.length()) > 3) continue;
            int d = levenshteinDistance(word,dw);
            if (d <= Math.max(2, word.length()/3)) out.add(new Suggestion(dw,d));
        }
        out.sort(Comparator.comparingInt((Suggestion s)->s.distance).thenComparing(s->s.word));
        return out.size()>5 ? new ArrayList<>(out.subList(0,5)) : out;
    }

    public static int levenshteinDistance(String a, String b) {
        int[] prev = new int[b.length()+1], cur = new int[b.length()+1];
        for(int j=0;j<=b.length();j++) prev[j]=j;
        for(int i=1;i<=a.length();i++) {
            cur[0]=i;
            for(int j=1;j<=b.length();j++) {
                int cost=a.charAt(i-1)==b.charAt(j-1)?0:1;
                cur[j]=Math.min(Math.min(cur[j-1]+1,prev[j]+1),prev[j-1]+cost);
            }
            int[] tmp=prev;prev=cur;cur=tmp;
        }
        return prev[b.length()];
    }

    private static List<String> extractWords(String text) {
        List<String> out=new ArrayList<>();
        java.util.regex.Matcher m=java.util.regex.Pattern.compile("[A-Za-z]+(?:'[A-Za-z]+)?").matcher(text);
        while(m.find()) out.add(m.group());
        return out;
    }

    private static void website(HttpExchange ex) throws IOException {
        String path=ex.getRequestURI().getPath();
        if(path.equals("/")) path="/index.html";
        Path root=Paths.get("web").toAbsolutePath().normalize();
        Path file=root.resolve(path.substring(1)).normalize();
        if(!file.startsWith(root) || !Files.isRegularFile(file)) { byte[] b="Not found".getBytes(StandardCharsets.UTF_8); ex.sendResponseHeaders(404,b.length); try(OutputStream o=ex.getResponseBody()){o.write(b);} return; }
        String type=path.endsWith(".css")?"text/css; charset=utf-8":path.endsWith(".js")?"application/javascript; charset=utf-8":"text/html; charset=utf-8";
        ex.getResponseHeaders().set("Content-Type",type);
        ex.getResponseHeaders().set("X-Content-Type-Options","nosniff");
        byte[] b=Files.readAllBytes(file); ex.sendResponseHeaders(200,b.length); try(OutputStream o=ex.getResponseBody()){o.write(b);}
    }

    private static void setCorsAndHeaders(HttpExchange ex) {
        ex.getResponseHeaders().set("Cache-Control","no-store");
        ex.getResponseHeaders().set("X-Content-Type-Options","nosniff");
        ex.getResponseHeaders().set("Content-Security-Policy","default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:");
    }
    private static void json(HttpExchange ex,int status,String body) throws IOException {
        byte[] b=body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type","application/json; charset=utf-8");
        ex.sendResponseHeaders(status,b.length); try(OutputStream o=ex.getResponseBody()){o.write(b);}
    }
    private static Map<String,String> form(HttpExchange ex) throws IOException {
        String body=new String(ex.getRequestBody().readAllBytes(),StandardCharsets.UTF_8);
        Map<String,String> map=new HashMap<>();
        for(String part:body.split("&")) { String[] p=part.split("=",2); if(p.length==2) map.put(URLDecoder.decode(p[0],StandardCharsets.UTF_8),URLDecoder.decode(p[1],StandardCharsets.UTF_8)); }
        return map;
    }
    private static String cookie(HttpExchange ex,String name) {
        List<String> cookies=ex.getRequestHeaders().get("Cookie"); if(cookies==null)return null;
        for(String line:cookies) for(String part:line.split(";")) { String[] p=part.trim().split("=",2); if(p.length==2&&p[0].equals(name))return p[1]; } return null;
    }
    private static Session getSession(HttpExchange ex) {
        String token=cookie(ex,"IC_SESSION"); if(token==null)return null;
        Session s=sessions.get(token); if(s!=null && s.expires>System.currentTimeMillis()) return s;
        sessions.remove(token); return null;
    }
    private static void createSession(HttpExchange ex,User u) {
        String token=randomHex(32); sessions.put(token,new Session(u,System.currentTimeMillis()+8*60*60*1000L));
        ex.getResponseHeaders().add("Set-Cookie","IC_SESSION="+token+"; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800");
    }
    private static User findUser(String email) throws IOException {
        for(User u:readUsers()) if(u.email.equalsIgnoreCase(email)) return u; return null;
    }
    private static List<User> readUsers() throws IOException {
        List<User> all=new ArrayList<>(); if(!Files.exists(USERS))return all;
        for(String line:Files.readAllLines(USERS)) { String[] p=line.split("\t",-1); if(p.length>=6) all.add(new User(p[0],p[1],p[2],p[3],p[4],p[5])); }
        return all;
    }
    private static String userJson(User u) { return "{\"name\":"+q(u.name)+",\"email\":"+q(u.email)+",\"role\":"+q(u.role)+"}"; }
    private static String hashPassword(String password,String salt) throws Exception {
        PBEKeySpec spec=new PBEKeySpec(password.toCharArray(),hexBytes(salt),120000,256);
        byte[] hash=SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        spec.clearPassword(); return Base64.getEncoder().encodeToString(hash);
    }
    private static String randomHex(int bytes) { byte[] b=new byte[bytes]; random.nextBytes(b); StringBuilder s=new StringBuilder(); for(byte x:b)s.append(String.format("%02x",x)); return s.toString(); }
    private static byte[] hexBytes(String s) { byte[] b=new byte[s.length()/2]; for(int i=0;i<b.length;i++) b[i]=(byte)Integer.parseInt(s.substring(i*2,i*2+2),16); return b; }
    private static String safe(String s) { return s.replace("\t"," ").replace("\r"," ").replace("\n"," "); }
    private static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\""; }
    private static String jsonValue(Object v) {
        if(v==null)return "null";
        if(v instanceof String)return q((String)v);
        if(v instanceof Number || v instanceof Boolean)return v.toString();
        if(v instanceof Map) { List<String> pairs=new ArrayList<>(); ((Map<?,?>)v).forEach((k,val)->pairs.add(q(String.valueOf(k))+":"+jsonValue(val))); return "{"+String.join(",",pairs)+"}"; }
        if(v instanceof Collection) { List<String> vals=new ArrayList<>(); for(Object x:(Collection<?>)v)vals.add(jsonValue(x)); return "["+String.join(",",vals)+"]"; }
        return q(v.toString());
    }
    private static class User { String name,email,salt,hash,role,created; User(String n,String e,String s,String h,String r,String c){name=n;email=e;salt=s;hash=h;role=r;created=c;} }
    private static class Session { User user; long expires; Session(User u,long e){user=u;expires=e;} }
    private static class Suggestion { String word; int distance; Suggestion(String w,int d){word=w;distance=d;} }
}
