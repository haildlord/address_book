export interface CreateAddressBook {
    name: string;
    address: string;
}

export interface GetUsersAddressBook extends CreateAddressBook {
    id: number;
    type: string;
    created_at: string;
}

export interface VerifyOwnershipBody {
    address: string;
    message: string;
    signature: string;
}

export interface DerivePdaBody {
    programId: string;
    seeds: string[];
}