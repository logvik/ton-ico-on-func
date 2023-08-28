import { Address, beginCell, Cell, fromNano, OpenedContract, toNano, } from '@ton/core';
import { compile, sleep, NetworkProvider, UIProvider, } from '@ton/blueprint';
import { JettonMinterICO, jettonContentToCell, } from '../wrappers/JettonMinterICO';
import { promptBool, promptAmount, promptAddress, displayContentCell, waitForTransaction, promptUrl, } from '../wrappers/utils';
let minterICOContract: OpenedContract<JettonMinterICO>;

const adminActions = ['Buy', 'Mint', 'Change admin', 'Change content', 'Change state', 'Withdrawal'];
const userActions  = ['Info', 'Quit'];

const failedTransMessage = (ui: UIProvider) => {
    ui.write("Failed to get indication of transaction completion from API!\nCheck result manually, or try again\n");
};

const infoAction = async (provider: NetworkProvider, ui: UIProvider) => {
    const jettonData = await minterICOContract.getJettonData();
    ui.write("Jetton info:\n\n");
    ui.write(`Admin: ${jettonData.adminAddress}\n`);
    ui.write(`Total supply: ${fromNano(jettonData.totalSupply)}\n`);
    ui.write(`Mintable: ${jettonData.mintable}\n`);
    const displayContent = await ui.choose('Display content?', ['Yes', 'No'], (c) => c);
    if (displayContent == 'Yes') {
        displayContentCell(jettonData.content, ui);
    }
    const displayICO = await ui.choose('Display ICO info?', ['Yes', 'No'], (c) => c);
    if (displayICO == 'Yes') {
        const ICOData = await minterICOContract.getICOData();
        ui.write("ICO info:\n\n");
        ui.write(`State: ${ICOData.state}\n`);
        ui.write(`Price: ${ICOData.price}\n`);
        ui.write(`Cap: ${ICOData.cap}\n`);
        ui.write(`Start date: ${fromNano(ICOData.start_date)}\n`);
        ui.write(`End date: ${fromNano(ICOData.end_date)}\n`);
    }
};

const changeAdminAction = async (provider: NetworkProvider, ui: UIProvider) => {
    let retry: boolean;
    let newAdmin: Address;
    let curAdmin = await minterICOContract.getAdminAddress();
    do {
        retry = false;
        newAdmin = await promptAddress('Please specify new admin address:', ui);
        if (newAdmin.equals(curAdmin)) {
            retry = true;
            ui.write("Address specified matched current admin address!\nPlease pick another one.\n");
        }
        else {
            ui.write(`New admin address is going to be: ${newAdmin}\nKindly double check it!\n`);
            retry = !(await promptBool('Is it ok?(yes/no)', ['yes', 'no'], ui));
        }
    } while (retry);

    const lastSeqno = (await provider.api().getLastBlock()).last.seqno;
    const curState = (await provider.api().getAccountLite(lastSeqno, minterICOContract.address)).account;

    if (curState.last === null)
        throw ("Last transaction can't be null on deployed contract");

    await minterICOContract.sendChangeAdmin(provider.sender(), newAdmin);
    const transDone = await waitForTransaction(provider,
        minterICOContract.address,
        curState.last.lt,
        10);
    if (transDone) {
        const adminAfter = await minterICOContract.getAdminAddress();
        if (adminAfter.equals(newAdmin)) {
            ui.write("Admin changed successfully");
        } else {
            ui.write("Admin address hasn't changed!\nSomething went wrong!\n");
        }
    } else {
        failedTransMessage(ui);
    }
};

const changeContentAction = async (provider: NetworkProvider, ui: UIProvider) => {
    let retry: boolean;
    let newContent: string;
    let curContent = await minterICOContract.getContent();
    do {
        retry = false;
        newContent = await promptUrl('Please specify new content:', ui);
        if (curContent.equals(jettonContentToCell({ type: 1, uri: newContent }))) {
            retry = true;
            ui.write("URI specified matched current content!\nPlease pick another one.\n");
        } else {
            ui.write(`New content is going to be: ${newContent}\nKindly double check it!\n`);
            retry = !(await promptBool('Is it ok?(yes/no)', ['yes', 'no'], ui));
        }
    } while (retry);

    const lastSeqno = (await provider.api().getLastBlock()).last.seqno;
    const curState = (await provider.api().getAccountLite(lastSeqno, minterICOContract.address)).account;

    if (curState.last === null)
        throw ("Last transaction can't be null on deployed contract");

    await minterICOContract.sendChangeContent(provider.sender(), jettonContentToCell({ type: 1, uri: newContent }));
    const transDone = await waitForTransaction(provider,
        minterICOContract.address,
        curState.last.lt,
        10);
    if (transDone) {
        const contentAfter = await minterICOContract.getContent();
        if (contentAfter.equals(jettonContentToCell({ type: 1, uri: newContent }))) {
            ui.write("Content changed successfully");
        } else {
            ui.write("Content hasn't changed!\nSomething went wrong!\n");
        }
    } else {
        failedTransMessage(ui);
    }
};

const changeStateAction = async (provider: NetworkProvider, ui: UIProvider) => {
    let retry: boolean;
    let newICOState: boolean;
    let curICOState = await minterICOContract.getICOState();
    do {
        retry = false;
        newICOState = await promptBool('Please specify new state, yes - pause, no - resume:', ['yes', 'no'], ui);
        if (curICOState == newICOState) {
            retry = true;
            ui.write("ICO state specified matched current state!\nPlease pick another one.\n");
        } else {
            ui.write(`New ICO state is going to be: ${newICOState}\nKindly double check it!\n`);
            retry = !(await promptBool('Is it ok?(yes/no)', ['yes', 'no'], ui));
        }
    } while (retry);

    const lastSeqno = (await provider.api().getLastBlock()).last.seqno;
    const curState = (await provider.api().getAccountLite(lastSeqno, minterICOContract.address)).account;

    if (curState.last === null)
        throw ("Last transaction can't be null on deployed contract");

    await minterICOContract.sendChangeState(provider.sender(), newICOState);
    const transDone = await waitForTransaction(provider,
        minterICOContract.address,
        curState.last.lt,
        10);
    if (transDone) {
        const stateAfter = await minterICOContract.getICOState();
        if (stateAfter == newICOState) {
            ui.write("ICO state changed successfully");
        } else {
            ui.write("ICO state hasn't changed!\nSomething went wrong!\n");
        }
    } else {
        failedTransMessage(ui);
    }
};

const mintAction = async (provider: NetworkProvider, ui: UIProvider) => {
    const sender = provider.sender();
    let retry: boolean;
    let mintAddress: Address;
    let mintAmount: string;
    let forwardAmount: string;

    do {
        retry = false;
        const fallbackAddr = sender.address ?? await minterICOContract.getAdminAddress();
        mintAddress = await promptAddress(`Please specify address to mint to`, ui, fallbackAddr);
        mintAmount = await promptAmount('Please provide mint amount in decimal form:', ui);
        ui.write(`Mint ${mintAmount} tokens to ${mintAddress}\n`);
        retry = !(await promptBool('Is it ok?(yes/no)', ['yes', 'no'], ui));
    } while (retry);

    ui.write(`Minting ${mintAmount} to ${mintAddress}\n`);
    const supplyBefore = await minterICOContract.getTotalSupply();
    const nanoMint = toNano(mintAmount);
    
    const lastSeqno = (await provider.api().getLastBlock()).last.seqno;
    const curState = (await provider.api().getAccountLite(lastSeqno, minterICOContract.address)).account;

    if (curState.last === null)
        throw ("Last transaction can't be null on deployed contract");

    const res = await minterICOContract.sendMint(sender,
        mintAddress,
        nanoMint,
        toNano('0.05'),
        toNano('0.1'));
    const gotTrans = await waitForTransaction(provider,
        minterICOContract.address,
        curState.last.lt,
        10);
    if (gotTrans) {
        const supplyAfter = await minterICOContract.getTotalSupply();
        if (supplyAfter == supplyBefore + nanoMint) {
            ui.write("Mint successfull!\nCurrent supply:" + fromNano(supplyAfter));
        }
        else {
            ui.write("Mint failed!");
        }
    }
    else {
        failedTransMessage(ui);
    }
}

const buyAction = async (provider: NetworkProvider, ui: UIProvider) => {
    const sender = provider.sender();
    let retry: boolean;
    let amountToBuy: string;

    do {
        retry = false;
        amountToBuy = await promptAmount('Please provide TON amount in decimal form:', ui);
        ui.write(`Buying on ${amountToBuy}\n`);
        retry = !(await promptBool('Is it ok?(yes/no)', ['yes', 'no'], ui));
    } while (retry);

    const supplyBefore = await minterICOContract.getTotalSupply();
    const lastSeqno = (await provider.api().getLastBlock()).last.seqno;
    const curState = (await provider.api().getAccountLite(lastSeqno, minterICOContract.address)).account;

    if (curState.last === null)
        throw ("Last transaction can't be null on deployed contract");

    const res = await minterICOContract.sendBuy(sender, toNano(amountToBuy));
    const gotTrans = await waitForTransaction(provider,
        minterICOContract.address,
        curState.last.lt,
        10);
    if (gotTrans) {
        const supplyAfter = await minterICOContract.getTotalSupply();

        if (supplyAfter > supplyBefore) {
            ui.write("Buying successfull!\nYou have received:" + fromNano(supplyAfter - supplyBefore));
        }
        else {
            ui.write("Buying failed!");
        }
    }
    else {
        failedTransMessage(ui);
    }
}

const withdrawalAction = async (provider: NetworkProvider, ui: UIProvider) => {
    const sender = provider.sender();
    let retry: boolean;

    do {
        retry = false;
        retry = !(await promptBool('Is it ok to withdraw TON from ICO on the admin wallet?(yes/no)', ['yes', 'no'], ui));
    } while (retry);

    const lastSeqno = (await provider.api().getLastBlock()).last.seqno;
    const curState = (await provider.api().getAccountLite(lastSeqno, minterICOContract.address)).account;

    if (curState.last === null)
        throw ("Last transaction can't be null on deployed contract");

    const contractBalanceBefore = BigInt((await provider.api().getAccountLite(lastSeqno, minterICOContract.address)).account.balance.coins);

    const res = await minterICOContract.sendWithdraw(sender);
    const gotTrans = await waitForTransaction(provider,
        minterICOContract.address,
        curState.last.lt,
        10);
    if (gotTrans) {
        const lastSeqno = (await provider.api().getLastBlock()).last.seqno;
        const contractBalanceAfter = BigInt((await provider.api().getAccountLite(lastSeqno, minterICOContract.address)).account.balance.coins);

        if (contractBalanceAfter < contractBalanceBefore) {
            ui.write("Withdrawal successfull!\nYou have received:" + fromNano(contractBalanceBefore - contractBalanceAfter));
        } else {
            ui.write("Withdrawal failed!");
        }
    } else {
        failedTransMessage(ui);
    }
}

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const sender = provider.sender();
    const hasSender = sender.address !== undefined;
    const api = provider.api()
    const minterICOCode = await compile('JettonMinterICO');
    let done = false;
    let retry: boolean;
    let ICOAddress: Address;

    do {
        retry = false;
        ICOAddress = await promptAddress('Please enter ICO address:', ui);
        const isContractDeployed = await provider.isContractDeployed(ICOAddress);
        if (!isContractDeployed) {
            retry = true;
            ui.write("This contract is not active!\nPlease use another address, or deploy it firs");
        }
        else {
            const lastSeqno = (await api.getLastBlock()).last.seqno;
            const contractState = (await api.getAccount(lastSeqno, ICOAddress)).account.state as {
                data: string | null;
                code: string | null;
                type: "active";
            };
            if (!(Cell.fromBase64(contractState.code as string)).equals(minterICOCode)) {
                ui.write("Contract code differs from the current contract version!\n");
                const resp = await ui.choose("Use address anyway", ["Yes", "No"], (c) => c);
                retry = resp == "No";
            }
        }
    } while (retry);

    minterICOContract = provider.open(JettonMinterICO.createFromAddress(ICOAddress));
    const isAdmin = hasSender ? (await minterICOContract.getAdminAddress()).equals(sender.address) : true;
    let actionList: string[];
    if (isAdmin) {
        actionList = [...adminActions, ...userActions];
        ui.write("Current wallet is ICO admin!\n");
    }
    else {
        actionList = userActions;
        ui.write("Current wallet is not admin!\nAvaliable actions restricted\n");
    }

    do {
        const action = await ui.choose("Pick action:", actionList, (c) => c);
        switch (action) {
            case 'Mint':
                await mintAction(provider, ui);
                break;
            case 'Buy':
                await buyAction(provider, ui);
                break;
            case 'Withdrawal':
                await withdrawalAction(provider, ui);
                break;
            case 'Change admin':
                await changeAdminAction(provider, ui);
                break;
            case 'Change content':
                await changeContentAction(provider, ui);
                break;
            case 'Change state':
                await changeStateAction(provider, ui);
                break;
            case 'Info':
                await infoAction(provider, ui);
                break;
            case 'Quit':
                done = true;
                break;
        }
    } while (!done);
}