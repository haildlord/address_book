import pg from "pg";

export const db = new pg.Client({
    host : "localhost",
    password: "Makechange@123",
    port : 5432,
    database : "address-book",
    user : "postgres"
});

db.connect();

await db.query(`create table if not exists user_address_book(
    id serial primary key not null,
    name varchar(10) not null,
    address varchar(44) not null,
    type varchar(6) not null,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP  
)`);