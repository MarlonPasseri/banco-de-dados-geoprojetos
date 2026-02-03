import "dotenv/config";
import express from "express";
import cors from "cors";
import { router } from "./routes.js";

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};


const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", router);

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API on http://0.0.0.0:${PORT}/api`);
});


