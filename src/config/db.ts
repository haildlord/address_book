import pg from "pg";

export const db = new pg.Client({
    host : process.env.DB_HOST ?? "localhost",
    password: process.env.DB_PASSWORD,
    port : Number(process.env.DB_PORT ?? 5432),
    database : process.env.DB_NAME ?? "address-book",
    user : process.env.DB_USER ?? "postgres"
});

db.connect();

await db.query(`create table if not exists user_address_book(
    id serial primary key not null,
    name varchar(10) not null,
    address varchar(44) not null,
    type varchar(6) not null,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP  
)`);