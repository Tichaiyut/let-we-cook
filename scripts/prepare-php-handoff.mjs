import { copyFile, cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const client = resolve(root, "dist", "client");
const release = resolve(root, "php-release");

await mkdir(release, { recursive: true });
await cp(client, release, { recursive: true, force: true });
await copyFile(resolve(root, "php", "tech_feed_todo.php"), resolve(release, "tech_feed_todo.php"));
await copyFile(resolve(root, "php", "PHP_HANDOFF.md"), resolve(release, "PHP_HANDOFF.md"));
await cp(resolve(root, "apps-script"), resolve(release, "apps-script"), { recursive: true, force: true });

console.log("PHP handoff prepared in php-release/");
