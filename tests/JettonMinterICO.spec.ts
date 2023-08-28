import 'dotenv/config';
import { Blockchain, SandboxContract, TreasuryContract, Verbosity, internal } from '@ton/sandbox';
import { Cell, toNano, beginCell, Address, SendMode } from '@ton/core';
import { JettonWallet } from '../wrappers/JettonWallet';
import { JettonMinterICO, jettonContentToCell } from '../wrappers/JettonMinterICO';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

//jetton params
let min_tons_for_storage = 10000000n;

describe('JettonMinterICO', () => {
    let wallet_code: Cell;
    let minter_code: Cell;
    let blockchain: Blockchain;
    let deployer:SandboxContract<TreasuryContract>;
    let notDeployer:SandboxContract<TreasuryContract>;
    let jettonMinter:SandboxContract<JettonMinterICO>;
    let userWallet:any;
    let content:Cell;
    let state:number;
    let price:bigint;
    let cap:bigint;
    let ico_start_date:number;
    let ico_end_date:number;

    beforeAll(async () => {
        minter_code    = await compile('JettonMinterICO');
        blockchain     = await Blockchain.create();
        deployer       = await blockchain.treasury('deployer');
        notDeployer    = await blockchain.treasury('notDeployer');
        content        = jettonContentToCell({type: 1, uri: process.env.JETTON_CONTENT_URI ? process.env.JETTON_CONTENT_URI: ""});
        wallet_code    = await compile('JettonWallet');
        state          = process.env.JETTON_STATE ? Number(process.env.JETTON_STATE).valueOf() : 0;
        price          = process.env.JETTON_PRICE ? BigInt(process.env.JETTON_PRICE).valueOf() : BigInt(1000000000);
        cap            = process.env.JETTON_CAP ? BigInt(process.env.JETTON_CAP).valueOf() : BigInt(1000000000);
        ico_start_date = process.env.JETTON_ICO_START_DATE ? Number(process.env.JETTON_ICO_START_DATE).valueOf() : 0;
        ico_end_date   = process.env.JETTON_ICO_END_DATE ? Number(process.env.JETTON_ICO_END_DATE).valueOf() : 0;

        jettonMinter   = blockchain.openContract(
                   JettonMinterICO.createFromConfig(
                     {
                       admin: deployer.address,
                       state,
                       content,
                       wallet_code,
                       price: price as bigint,
                       cap: cap as bigint,
                       ico_start_date,
                       ico_end_date,
                     },
                     minter_code));
        userWallet = async (address:Address) => blockchain.openContract(
                          JettonWallet.createFromAddress(
                            await jettonMinter.getWalletAddress(address)
                          )
                     );
    });

    // implementation detail
    it('should deploy', async () => {
        const deployResult = await jettonMinter.sendDeploy(deployer.getSender(), toNano('1'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonMinter.address,
            deploy: true,
        });
    });
    // implementation detail
    it('check that all ICO parameters are ok', async () => {
        expect(await jettonMinter.getICOState()).toEqual(Boolean(state));
        expect(await jettonMinter.getICOPrice()).toEqual(price);
        expect(await jettonMinter.getICOCap()).toEqual(cap);
        expect(await jettonMinter.getICOStartDate()).toEqual(ico_start_date);
        expect(await jettonMinter.getICOEndDate()).toEqual(ico_end_date);
    });
    // implementation detail
    it('minter admin can change state', async () => {
        let changeState = await jettonMinter.sendChangeState(deployer.getSender(), true);
        expect(await jettonMinter.getICOState()).toBe(true);
        changeState = await jettonMinter.sendChangeState(deployer.getSender(), false);
        expect(await jettonMinter.getICOState()).toBe(false);
    });
    it('not a minter admin can not change state', async () => {
        let changeState = await jettonMinter.sendChangeState(notDeployer.getSender(), true);
        expect(await jettonMinter.getICOState()).toBe(false);
        expect(changeState.transactions).toHaveTransaction({
            from: notDeployer.address,
            to: jettonMinter.address,
            aborted: true,
            exitCode: 77, // error::unauthorized_change_content_request
        });
    });
    // implementation detail
    it('not a minter admin can not withdraw', async () => {
        let withdraw = await jettonMinter.sendWithdraw(notDeployer.getSender());
        expect(withdraw.transactions).toHaveTransaction({
            from: notDeployer.address,
            to: jettonMinter.address,
            aborted: true,
            exitCode: 78, // error::unauthorized_withdraw_request
        });
    });
    it('minter admin can withdraw excess', async () => {
        await deployer.send({value:toNano('1'), bounce:false, to: jettonMinter.address});
        let initialBalance = (await blockchain.getContract(deployer.address)).balance;
        let initialJettonMinterBalance = (await blockchain.getContract(jettonMinter.address)).balance;
        const withdrawResult = await jettonMinter.sendWithdraw(deployer.getSender());
        expect(withdrawResult.transactions).toHaveTransaction({ //excesses
            from: jettonMinter.address,
            to: deployer.address
        });
        let finalBalance = (await blockchain.getContract(deployer.address)).balance;
        let finalJettonMinterBalance = (await blockchain.getContract(jettonMinter.address)).balance;
        expect(finalJettonMinterBalance).toEqual(min_tons_for_storage);
        expect(finalBalance - initialBalance).toBeGreaterThan(toNano('0.99'));
    });
    it('minter admin can withdraw, but nothing yet', async () => {
        let tonBalanceInitial = (await blockchain.getContract(jettonMinter.address)).balance;
        await jettonMinter.sendWithdraw(deployer.getSender());
        let tonBalance = (await blockchain.getContract(jettonMinter.address)).balance;
        expect(tonBalanceInitial).toEqual(tonBalance);
    });
    // implementation detail
    it('anyone can buy during ICO', async () => {
        await jettonMinter.sendBuy(notDeployer.getSender(), toNano('1'));
        const nonDeployerJettonWallet = await userWallet(notDeployer.address);
        expect(await nonDeployerJettonWallet.getJettonBalance()).toEqual(price*(toNano('1')-min_tons_for_storage));
    });
    // implementation detail
    it('impossible to buy less than min amount', async () => {
        let buy = await jettonMinter.sendBuy(notDeployer.getSender(), min_tons_for_storage);
        expect(buy.transactions).toHaveTransaction({
            from: notDeployer.address,
            to: jettonMinter.address,
            aborted: true,
            exitCode: 79, // error::min_amount
        });
    });
    // implementation detail
    it('impossible to buy more than cap', async () => {
        let buy = await jettonMinter.sendBuy(notDeployer.getSender(), ((cap*BigInt(100)/price)/BigInt(100)));
        expect(buy.transactions).toHaveTransaction({
            from: notDeployer.address,
            to: jettonMinter.address,
            aborted: true,
            exitCode: 80, // error::cap_exceeded
        });
    });
    // implementation detail
    it('impossible to buy before start, if it is not 0', async () => {
        if (ico_start_date != 0 ) {
            let buy = await jettonMinter.sendBuy(notDeployer.getSender(), toNano('1'));
            expect(buy.transactions).toHaveTransaction({
                from: notDeployer.address,
                to: jettonMinter.address,
                aborted: true,
                exitCode: 81, // error::ico_closed
            });
        }
    });
    // implementation detail
    it('impossible to buy after end, if it is not 0', async () => {
        if (ico_end_date != 0 ) {
            let buy = await jettonMinter.sendBuy(notDeployer.getSender(), toNano('1'));
            expect(buy.transactions).toHaveTransaction({
                from: notDeployer.address,
                to: jettonMinter.address,
                aborted: true,
                exitCode: 82, // error::ico_expired
            });
        }
    });
    // implementation detail
    it('impossible to buy if paused', async () => {
        await jettonMinter.sendChangeState(deployer.getSender(), true);
        let buy = await jettonMinter.sendBuy(notDeployer.getSender(), toNano('1'));
        expect(buy.transactions).toHaveTransaction({
            from: notDeployer.address,
            to: jettonMinter.address,
            aborted: true,
            exitCode: 83, // error::paused
        });
        await jettonMinter.sendChangeState(deployer.getSender(), false);
    });
});