import express from "express";
import contactRouter from "./contactRouter.js"
import verifyRouter from "./verifyRouter.js"

const router = express.Router();

router.use("/contacts", contactRouter);
router.use("/verify-ownership", verifyRouter);


export default router;