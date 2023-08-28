import 'dotenv/config';
import { address, toNano, } from '@ton/core';
import { JettonMinterICO, jettonContentToCell } from '../wrappers/JettonMinterICO';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const admin = address(process.env.JETTON_ADMIN ? process.env.JETTON_ADMIN : "");
    const content = jettonContentToCell({ type: 1, uri: process.env.JETTON_CONTENT_URI ? process.env.JETTON_CONTENT_URI : "" });
    const wallet_code = await compile('JettonWallet');
    const state = process.env.JETTON_STATE ? Number(process.env.JETTON_STATE).valueOf() : 0;
    const price = process.env.JETTON_PRICE ? BigInt(process.env.JETTON_PRICE).valueOf() : BigInt(1000000000);
    const cap = process.env.JETTON_CAP ? BigInt(process.env.JETTON_CAP).valueOf() : BigInt(1000000000);
    const ico_start_date = process.env.JETTON_ICO_START_DATE ? Number(process.env.JETTON_ICO_START_DATE).valueOf() : 0;
    const ico_end_date = process.env.JETTON_ICO_END_DATE ? Number(process.env.JETTON_ICO_END_DATE).valueOf() : 0;

    const minter = provider.open(
        JettonMinterICO.createFromConfig(
            {
                admin,
                content,
                wallet_code,
                state,
                price,
                cap,
                ico_start_date,
                ico_end_date
            },
            await compile('JettonMinterICO')
        )
    );

    await minter.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(minter.address);

    console.log('getTotalSupply', await minter.getTotalSupply());
}