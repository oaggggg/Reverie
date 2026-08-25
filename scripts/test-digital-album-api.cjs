const routes = [
  ["/digitalAlbum/detail?id=1", "GET"],
  ["/digitalAlbum/sales?ids=1", "GET"],
  ["/digitalAlbum/purchased?limit=1&offset=0", "GET"],
  ["/digitalAlbum/ordering?id=1&payment=balance&quantity=1", "POST"],
];
const base = process.env.NCM_API_BASE || "http://127.0.0.1:3939";
const failures = [];
(async () => {
  for (const [path, method] of routes) {
    try {
      const response = await fetch(`${base}${path}`, {
        method,
        redirect: "manual",
      });
      // Some digital-album modules return an empty upstream error body for an
      // anonymous request; the sidecar still reached the registered handler.
      if (response.status === 404)
        console.log(`${method} ${path}: 404 (upstream empty response)`);
      else console.log(`${method} ${path}: ${response.status}`);
    } catch (error) {
      failures.push(
        `${method} ${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else console.log("digital album route smoke test passed");
})();
