import { createServer } from "node:http";
import { handle } from "./router.js";

const PORT = 8091;

createServer(handle).listen(PORT, "127.0.0.1", () => console.log(`Tranox web on http://127.0.0.1:${PORT}`));
