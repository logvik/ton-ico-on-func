# TON ICO repository

<p style="text-align:center;"><img src="./docs/images/ton-ico.png" width="256" alt="TON ICO" title="TON ICO"/></p>

This repository is dedicated to the development of code that will facilitate the conduction of an Initial Coin Offering (ICO) on the Telegram Open Network (TON) blockchain. The ICO will be conducted for the purpose of launching a new jetton, the TEP-89, which will be fully compatible with the TEP-74 standard. The code contained in this repository will enable the smooth and secure operation of the ICO, providing investors with a reliable and transparent platform to participate in the launch of this exciting new jetton. Furthermore, the TEP-89 jetton will be designed to offer a range of benefits and functionalities that will make it an attractive investment opportunity for both experienced and novice cryptocurrency investors alike.

The ICO platform offers a range of features to ensure a successful fundraising campaign. These include:

1. Custom pricing: Tailor your ICO to your needs by setting a rate for issuing jettons based on TON amounts sent to the smart contract.
2. Cap: Set a maximum amount for issuance during the ICO, giving you greater control over your fundraising efforts.
3. Start time: Choose the date after which your ICO will be opened to the public, allowing you to plan your launch accordingly.
4. End time: Select the date after which your ICO will be closed, providing investors with a clear deadline to participate in your campaign.
5. Presale compatibility: With the ICO platform, you can premint jettons before the ICO goes live, giving early investors a chance to get in on the ground floor.
6. Pause/Resume logic: The platform allows you to split your ICO into multiple stages, giving you greater flexibility in managing your fundraising efforts.

By utilizing these features, you can create a robust and effective fundraising campaign that meets your needs and attracts investors.

# How to use for own ICO

1. Clone this repository
2. Install all dependencies ```yarn```
3. Rename `_.env` to `.env`

Fill out the values in `.env`:

```
JETTON_ADMIN="" # adress from which will be managed this ICO
JETTON_CONTENT_URI="" # URI for metadata by standard https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md
JETTON_STATE=0 # 0 - active, 1 - paused
JETTON_PRICE=2 #1 TON = 2 jetton
JETTON_CAP=77777000000000 # 77777 jetton maximum
JETTON_ICO_START_DATE=0 # right after deploy, but can be used unixtime
JETTON_ICO_END_DATE=0 # never, but can be used unixtime
```

# Tests

Before launching ICO on mainnet, you have to want to test it. For this aim you must to fill out `.env` and run

```js
yarn test
```

When you will test start/end dates be aware that many other tests will be failed, check only those tests that affected this feature.

# Deployment

When all tests will be finished, just run

```js
yarn deploy
```

and follow by the instructions

# Smart contract control

1. Changing admin (owner)
2. Changing jetton content
3. Pause/Resume feature to split on several steps
4. Withdrawal a balance from the minter smart contract after ICO

# UI for interaction with the ICO

```js
yarn controller
```

Keep in mind that you can use ton:// link to spread your ICO. Just choice "Buy" to obtain the link and don't pay. A user will be able to select its own amount if you will remove amount=1000000000 from the link.

For example:

```
ton://transfer/EQAHM3Xc_djTLCCEudIgAknu6ypK0zzdLTpTejhd3sebCzm7?amount=1000000000&bin=te6cckEBAQEADgAAGEAu_wsAAAAAAAAAAPnjyqo
```

And spread [ton://transfer/EQAHM3Xc_djTLCCEudIgAknu6ypK0zzdLTpTejhd3sebCzm7?bin=te6cckEBAQEADgAAGEAu_wsAAAAAAAAAAPnjyqo](ton://transfer/EQAHM3Xc_djTLCCEudIgAknu6ypK0zzdLTpTejhd3sebCzm7?bin=te6cckEBAQEADgAAGEAu_wsAAAAAAAAAAPnjyqo)

# Sources

https://docs.ton.org/develop/func/cookbook

https://github.com/ton-org/blueprint/

https://github.com/EmelyanenkoK/modern_jetton

https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md

https://base64.guru/converter/encode/image

# Licence

MIT