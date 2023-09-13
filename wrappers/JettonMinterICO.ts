import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';

export type JettonMinterICOContent = {
    type: 0 | 1,
    uri: string
};

export type JettonMinterICOConfig = { admin: Address; content: Cell; wallet_code: Cell, state: number, price: bigint, cap: bigint, ico_start_date: number, ico_end_date: number };

export function jettonMinterConfigToCell(config: JettonMinterICOConfig): Cell {
    return beginCell()
        .storeCoins(0)
        .storeBit(0)
        .storeUint(config.price, 64)
        .storeUint(config.cap, 64)
        .storeUint(config.ico_start_date, 32)
        .storeUint(config.ico_end_date, 32)
        .storeAddress(config.admin)
        .storeRef(config.content)
        .storeRef(config.wallet_code)
        .endCell();
}

export function jettonContentToCell(content: JettonMinterICOContent) {
    return beginCell()
        .storeUint(content.type, 8)
        .storeStringTail(content.uri) //Snake logic under the hood
        .endCell();
}

export class JettonMinterICO implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) { }

    static createFromAddress(address: Address) {
        return new JettonMinterICO(address);
    }

    static createFromConfig(config: JettonMinterICOConfig, code: Cell, workchain = 0) {
        const data = jettonMinterConfigToCell(config);
        const init = { code, data };
        return new JettonMinterICO(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY
        });
    }

    static mintMessage(to: Address, jetton_amount: bigint, forward_ton_amount: bigint, total_ton_amount: bigint,) {
        return beginCell().storeUint(0x4fda1e51, 32).storeUint(0, 64) // op, queryId
            .storeAddress(to).storeCoins(jetton_amount)
            .storeCoins(forward_ton_amount).storeCoins(total_ton_amount)
            .endCell();
    }

    async sendMint(provider: ContractProvider, via: Sender, to: Address, jetton_amount: bigint, forward_ton_amount: bigint, total_ton_amount: bigint,) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonMinterICO.mintMessage(to, jetton_amount, forward_ton_amount, total_ton_amount,),
            value: total_ton_amount + toNano("0.1"),
        });
    }

    static discoveryMessage(owner: Address, include_address: boolean) {
        return beginCell().storeUint(0x2c76b973, 32).storeUint(0, 64) // op, queryId
            .storeAddress(owner).storeBit(include_address)
            .endCell();
    }

    async sendDiscovery(provider: ContractProvider, via: Sender, owner: Address, include_address: boolean, value: bigint = toNano('0.1')) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonMinterICO.discoveryMessage(owner, include_address),
            value: value,
        });
    }

    static changeAdminMessage(newOwner: Address) {
        return beginCell().storeUint(0x4840664f, 32).storeUint(0, 64) // op, queryId
            .storeAddress(newOwner)
            .endCell();
    }

    async sendChangeAdmin(provider: ContractProvider, via: Sender, newOwner: Address) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonMinterICO.changeAdminMessage(newOwner),
            value: toNano("0.1"),
        });
    }

    static changeContentMessage(content: Cell) {
        return beginCell().storeUint(0x11067aba, 32).storeUint(0, 64) // op, queryId
            .storeRef(content)
            .endCell();
    }

    async sendChangeContent(provider: ContractProvider, via: Sender, content: Cell) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonMinterICO.changeContentMessage(content),
            value: toNano("0.1"),
        });
    }

    static stateMessage(state: boolean) {
        return beginCell().storeUint(0x58ca5361, 32).storeUint(0, 64) // op, queryId
            .storeBit(state)
            .endCell();
    }

    async sendChangeState(provider: ContractProvider, via: Sender, state: boolean) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonMinterICO.stateMessage(state),
            value: toNano('0.2')
        });

    }

    static withdrawMessage() {
        return beginCell().storeUint(0x46ed2e94, 32).storeUint(0, 64) // op, queryId
            .endCell();
    }

    async sendWithdraw(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonMinterICO.withdrawMessage(),
            value: toNano('0.1')
        });

    }

    static buyMessage() {
        return beginCell().storeUint(0x402eff0b, 32).storeUint(0, 64) // op, queryId
            .endCell();
    }

    async sendBuy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonMinterICO.buyMessage(),
            value
        });

    }

    async getWalletAddress(provider: ContractProvider, owner: Address): Promise<Address> {
        const res = await provider.get('get_wallet_address', [{ type: 'slice', cell: beginCell().storeAddress(owner).endCell() }])
        return res.stack.readAddress()
    }

    async getJettonData(provider: ContractProvider) {
        let res = await provider.get('get_jetton_data', []);
        let totalSupply = res.stack.readBigNumber();
        let mintable = res.stack.readBoolean();
        let adminAddress = res.stack.readAddress();
        let content = res.stack.readCell();
        let walletCode = res.stack.readCell();
        return {
            totalSupply,
            mintable,
            adminAddress,
            content,
            walletCode
        };
    }

    async getTotalSupply(provider: ContractProvider) {
        let res = await this.getJettonData(provider);
        return res.totalSupply;
    }

    async getAdminAddress(provider: ContractProvider) {
        let res = await this.getJettonData(provider);
        return res.adminAddress;
    }

    async getContent(provider: ContractProvider) {
        let res = await this.getJettonData(provider);
        return res.content;
    }

    async getICOData(provider: ContractProvider) {
        let res = await provider.get('get_ico_data', []);
        let state = res.stack.readBoolean();
        let price = res.stack.readBigNumber();
        let cap = res.stack.readBigNumber();
        let start_date = res.stack.readNumber();
        let end_date = res.stack.readNumber();
        return {
            state,
            price,
            cap,
            start_date,
            end_date
        };
    }

    async getICOState(provider: ContractProvider) {
        let res = await this.getICOData(provider);
        return res.state;
    }

    async getICOPrice(provider: ContractProvider) {
        let res = await this.getICOData(provider);
        return res.price;
    }

    async getICOCap(provider: ContractProvider) {
        let res = await this.getICOData(provider);
        return res.cap;
    }

    async getICOStartDate(provider: ContractProvider) {
        let res = await this.getICOData(provider);
        return res.start_date;
    }

    async getICOEndDate(provider: ContractProvider) {
        let res = await this.getICOData(provider);
        return res.end_date;
    }

    async getJettonAmount(provider: ContractProvider, value: bigint) {
        let res = await provider.get('get_jetton_amount', [{type: "int", value}]);
        return res.stack.readBigNumber();
    }
}