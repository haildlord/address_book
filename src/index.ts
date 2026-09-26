import express from "express";
import { Express} from "express";
import cors from 'cors';
import {errorHandler} from "./middlewares/index.js";
import "./config/db.js";
import rootRouter from "./router/index.js";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use("/api", rootRouter)


app.use(errorHandler);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
