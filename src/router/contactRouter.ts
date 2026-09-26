import express from "express";

import {PublicKey} from "@solana/web3.js";
import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID 
} from "@solana/spl-token";

import {CreateAddressBook, GetUsersAddressBook} from "../interfaces/index.js"
import { AppError } from "../utils/AppError.js";
import { db } from "../config/db.js";
import { QueryResult } from "pg";


const router = express.Router();

router.post("/", async (req, res, next) => {
    
    let { name, address }: CreateAddressBook = req.body;
    if(!address || !name){
        return next(new AppError("missing or invalid fields", 400));
    }

    try{

        const entry = await db.query(`select address from user_address_book where address = $1`, [address]);
        if(entry.rows.length !== 0){
            return next(new AppError("address already exists", 409));
        }

        const isOnCurve = PublicKey.isOnCurve(address);
        
        const addressType: string = isOnCurve ? "wallet" : "pda";
        const insertedRow : QueryResult<GetUsersAddressBook> = await db.query(`insert into user_address_book (name, address, type) values ($1, $2, $3) returning *`, [name, address, addressType]);


        let {id, type, created_at} : GetUsersAddressBook = insertedRow.rows[0];

        return res.status(201).json({
            id,
            name,
            address,
            type,
            createdAt : created_at.toString()
        })

    }catch(err){
        return next(new AppError(`${err}`, 400))
    }

})

router.get("/", async (req, res, next) => {

    const type = req.query["type"] as string;

    let sqlQuery = `SELECT * FROM user_address_book`;
    const values: string[] = [];


    if (type) {
        sqlQuery += ` WHERE type = $1`;
        values.push(type);
    }

    try {
        const entry: QueryResult<GetUsersAddressBook> = await db.query(sqlQuery, values);
        
        return res.status(200).json({
            contacts: entry.rows 
        });
    } catch(err) {
        return next(new AppError(`${err}`, 500));
    }
});

router.get("/:id", async (req, res, next) => {

    let id = req.params["id"];

    if(!id || id == "0"){
        return next(new AppError("Invalid user id", 401));
    }

    try{
        const entry : QueryResult<GetUsersAddressBook> = await db.query(`select * from user_address_book where id = $1`, [id]);
        
        if(entry.rows.length === 0){
            return next(new AppError(`Contact not found`, 404));        
        }

        return res.status(200).json({
            contact : entry.rows[0]
        })

    }catch(err){
        return next(new AppError(`${err}`, 500));
    }

})

router.patch("/:id", async (req, res, next) => {

    const id = req.params["id"];
    if(!id || !/^\d+$/.test(id) || id == "0"){
        return next(new AppError("Invalid user id", 400));
    }

    const body = req.body ?? {};
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const address = body.address !== undefined ? String(body.address).trim() : undefined;

    if(name === undefined && address === undefined){
        return next(new AppError("nothing to update", 400));
    }
    if(name !== undefined && (!name || name.length > 10)){
        return next(new AppError("name must be 1-10 characters", 400));
    }

    try{
        const current = await db.query(`select * from user_address_book where id = $1`, [id]);
        if(current.rows.length === 0){
            return next(new AppError("Contact not found", 404));
        }

        let type: string = current.rows[0].type;
        if(address !== undefined){
            let key: PublicKey;
            try{
                key = new PublicKey(address);
            }catch{
                return next(new AppError("address is not a valid Solana public key", 400));
            }
            const dup = await db.query(`select id from user_address_book where address = $1 and id != $2`, [address, id]);
            if(dup.rows.length !== 0){
                return next(new AppError("address already exists", 409));
            }
            type = PublicKey.isOnCurve(key.toBytes()) ? "wallet" : "pda";
        }

        const updated: QueryResult<GetUsersAddressBook> = await db.query(
            `update user_address_book set name = $1, address = $2, type = $3 where id = $4 returning *`,
            [name ?? current.rows[0].name, address ?? current.rows[0].address, type, id]
        );

        return res.status(200).json({ contact : updated.rows[0] });

    }catch(err){
        return next(new AppError(`${err}`, 500));
    }

})

router.delete("/:id", async (req, res, next) => {

    let id = req.params["id"];

    if(!id || id == "0"){
        return next(new AppError("Invalid user id", 401));
    }

    try{

        const entry = await db.query(`select * from user_address_book where id = $1`, [id]);
        if(entry.rows.length === 0){
            return next(new AppError("User Not Found", 404));
        }

        await db.query(`delete from user_address_book where id = $1`, [id]);
        
        return res.status(200).json({
            message: "Contact deleted" 
        })

    }catch(err){
        return next(new AppError(`${err}`, 500));
    }

})


router.post("/:id/derive-ata", async (req, res, next) => {

    let mintAddress : string = req.body["mintAddress"];
    let id = req.params["id"];

    if(!id || id == "0" || !mintAddress){
        return next(new AppError("Invalid user id or mint address", 400));
    }

    try{
        const isOnCurve = PublicKey.isOnCurve(mintAddress);
        if(!isOnCurve){
            return next(new AppError("Invalid Mint address", 400));
        }

        const user = await db.query(`select address from user_address_book where id = $1`, [id]);
        if(user.rows.length === 0){
            return next(new AppError("contact not found", 404));
        }
        const address : string = user.rows[0]["address"];

        // TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
        // ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL
        const ata = PublicKey.findProgramAddressSync([new PublicKey(address).toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), new PublicKey(mintAddress).toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID)
        console.log(ata);

        return res.status(200).json({
            ata, 
            owner: address, 
            mint:  mintAddress
        })
    }catch(err){
        return next(new AppError("Counld not derive PDA", 500));
    }
});

export default router;



