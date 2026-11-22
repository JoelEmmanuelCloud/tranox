# Getting a client and a freelancer started on Tranox

Two short guides to send to new users, plus what the Tranox team needs back. The example is a client in Accra, Ghana paying a freelancer in Port Harcourt, Nigeria, who is paid in cNGN (naira).

The Ghana cedi is not one of the supported payout currencies (cNGN, IDRX, wARS, wBRL, wMXN, wCOP), so someone in Ghana takes part as the client.

---

## For the freelancer (Port Harcourt)

Hi! I'd like to pay you for a small job through Tranox. You'll be paid in **cNGN**, a naira stablecoin, straight to your wallet. Here's what to do:

### 1. Set up a wallet that can show naira (cNGN)

- Install **MetaMask** from the App Store or Google Play and create a new wallet.
- Write your 12-word recovery phrase on paper and keep it private. Never send it to anyone, including me.
- In MetaMask, switch the network to **Celo**. If Celo isn't listed, tap "Add network" and pick Celo from the popular list.
- Please don't use MiniPay for this. It doesn't show cNGN.

### 2. Send me your wallet address

- In MetaMask, tap your account name at the top to copy your address. It starts with `0x`.
- Send me your **name**, your **wallet address**, and that you're in **Nigeria**.

### 3. Do the job, then get paid

- When the client approves your work, the cNGN arrives in your wallet in under a minute.
- You'll get a link to your own page that shows every payment.
- To see the cNGN in MetaMask, open your page in MetaMask's built-in browser and tap **"Add cNGN to my wallet"**.
- Receiving costs you nothing.

---

## For the client (Accra)

Hi! I'd like you to pay a freelancer in Nigeria for a small real job through Tranox. You pay in dollars (USD₮) from **MiniPay**, and they receive naira.

### 1. Get ready

- Install **MiniPay** (from opera.com/products/minipay, or inside Opera Mini). It works in Ghana.
- Add a little more than the job price in **USD₮**. For a 1 USD₮ job, have about **1.10 USD₮**, because MiniPay takes a tiny network fee in dollars.
- Send me your **name** and your **MiniPay wallet address**. Open MiniPay, tap **Receive**, and copy the `0x…` address.

### 2. Pay the job (I'll send you a link)

- In MiniPay, open **Settings → Developer settings** and make sure **Use Testnet** is **OFF**.
- Tap **Load test page** and paste the link I send you.
- On the milestone, tap **Pay** and confirm in MiniPay.

### 3. Approve when the work is done

- Open the same link again and tap **Approve**, then **Sign**. Signing is free.
- Within about a minute the freelancer is paid in naira, and the page shows **Paid**.

---

## What the Tranox team needs back

1. **Freelancer:** name and MetaMask wallet address (`0x…`)
2. **Client:** name and MiniPay wallet address (`0x…`)
3. **The job:** a real task and a price of at least **1 USD₮** (Textile FX's minimum), for example "Logo sketch, 2 USD₮"

## What the Tranox team then does

1. Adds the freelancer to Tranox with cNGN as their payout currency.
2. Adds the freelancer's wallet to the allowed list on the server and restarts the worker, only when no payout is running.
3. Creates the job, locked to the client's wallet, with the milestone and price.
4. Sends the **client link** to the client and the **freelancer page link** to the freelancer.

## Rules that keep it a fair, independent payment

- The client pays with **their own money**. Tranox does not top up the client's wallet.
- It is a **real piece of work**, agreed between the client and the freelancer.
- A second job later counts even more, because repeat use matters to the judges.
