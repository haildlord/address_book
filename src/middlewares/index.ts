import { Express, Request, Response, NextFunction} from "express";
import { AppError } from "../utils/AppError.js";
// import { logger } from "../config/logger.js";

export function errorHandler(
    err : unknown,
    req : Request,
    res : Response,
    next : NextFunction
) { 
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success : false,
            message : err.message
        })    
    }

    // ! understand what and why is it written belwo :

      // 2. SyntaxError from express.json() bad payload
//   if (err instanceof SyntaxError && "status" in err && err.status === 400) {
//     return res.status(400).json({
//       success: false,
//       message: "Malformed JSON payload",
//     });
//   }
//   // 3. Unknown / Programmer Bug (500)
//   logger.error({ err, path: req.path, method: req.method }, "Unhandled Exception");
//   const message = process.env.NODE_ENV === "production" 
//     ? "Internal Server Error" 
//     : (err instanceof Error ? err.message : "Unexpected error");
//   return res.status(500).json({
//     success: false,
//     message,
//   });


res.status(500).json({
    success : false,
    message : "Internal server error"
})

}