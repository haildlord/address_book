export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
  
    constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
      
      super(message);

      this.statusCode = statusCode;
      this.name = "AppError";
      this.isOperational = isOperational;
      
      // Sometimes Javascript cannot difference between your custom Error like AppError vs 
      // inbuilt Error so it GLITCHES & if you ever wanna do x when AppError vs y on Error 
      // it sometime wrongly says and considers AppError as Error only so to solve this issue we do : 
      Object.setPrototypeOf(this, new.target.prototype);
  
      // It tells JavaScript, "Hide the part of the map where this error was constructed." 
      // This leaves you with a much cleaner log that points straight to the actual bug
      Error.captureStackTrace(this, this.constructor);
    }
  }