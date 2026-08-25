const routes = [
  ["/playlist/import/name/task/create?text=demo&playlistName=demo", "GET"],
  ["/playlist/import/task/status?id=1", "GET"],
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
      if (response.status === 404) failures.push(`${method} ${path}: 404`);
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
  } else {
    console.log("playlist import route smoke test passed");
  }
})();
