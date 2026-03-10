import { exec } from "child_process";

exec("npx vite build", (err, stdout, stderr) => {
  console.log(stdout);
  console.error(stderr);
});