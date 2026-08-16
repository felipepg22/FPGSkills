import { createServer } from "node:http";

const server = createServer((request, response) => {
  if ((request.method === "GET" || request.method === "HEAD") && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(request.method === "HEAD" ? undefined : JSON.stringify({ status: "ok" }));
    return;
  }
  response.writeHead(405, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "read-only fixture" }));
});

server.listen(3000, "127.0.0.1", () => process.stdout.write("read-only fixture listening on http://127.0.0.1:3000\n"));

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));

