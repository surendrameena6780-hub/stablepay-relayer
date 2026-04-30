# StablePay Checkout

## Executive Summary

StablePay Checkout is a static BNB Smart Chain payment dApp built for Trust Wallet-compatible browsers. Its core purpose is to let a user connect a wallet, detect the user’s USDT balance on BNB Smart Chain, and send a direct on-chain USDT transfer to a configured merchant address after the user confirms the transaction in the wallet.

This project is not a backend payment processor, not a subscription engine, and not a custom custody contract. It is a branded client-side checkout experience that wraps a standard ERC-20 transfer flow in a polished BNB-themed user interface.

At a high level, the current app does the following:

- Loads as a static web page.
- Connects to an injected wallet such as Trust Wallet.
- Switches the wallet to BNB Smart Chain if needed.
- Reads the connected wallet’s USDT balance and native BNB balance.
- Uses the full detected USDT balance by default when no fixed amount is passed in the URL.
- Opens the wallet’s native token-transfer confirmation flow.
- Waits for the on-chain receipt.
- Shows a custom success popup after confirmation.
- Shows a no-balance popup when the user tries again with zero USDT remaining.

## What We Are Building

This project is a one-page token checkout interface for BNB Chain.

The product goal is:

- Provide a branded transfer experience.
- Keep the UI clean and mobile-friendly.
- Use Trust Wallet’s native confirmation screen for the actual send step.
- Avoid backend complexity.
- Rely on direct user-confirmed on-chain payments.

The app is designed as a payment frontend, not as a full payment platform. There is no order database, no admin panel, no web server business logic, and no subscription management backend. Everything important happens in the browser and in the wallet.

## What Has Been Built

The current implementation includes:

- A branded landing and checkout page with BNB Chain styling.
- A main hero panel and action card for the transfer flow.
- Responsive desktop, tablet, and mobile layouts.
- Wallet detection and wallet connection.
- BNB Smart Chain network switching and network add fallback.
- USDT token metadata and balance read.
- Native BNB balance read for gas validation.
- Default full-balance transfer behavior when no explicit amount is passed in the URL.
- Direct ERC-20 transfer execution using ethers v6.
- Gas-fee estimation before submit.
- Success confirmation modal after a completed transfer.
- Empty-balance modal when the user retries after sending all USDT.
- Explorer link generation for the confirmed transaction.
- A test-only mock USDT contract for QA.

## Product Behavior in Plain Language

The app behaves like this:

1. A user opens the link.
2. The user taps the main action button.
3. The app connects the wallet if not already connected.
4. The app makes sure the wallet is on BNB Smart Chain.
5. The app reads the available USDT balance and BNB gas balance.
6. If no fixed amount is configured in the URL, the app prepares to send the full detected USDT balance.
7. If the wallet is ready, the app opens the native wallet confirmation screen.
8. The user confirms inside Trust Wallet.
9. The transfer is sent on-chain.
10. The app waits for confirmation.
11. A custom success popup appears.
12. If the user later taps again with no USDT left, a no-balance popup appears instead of a dead button.

## What This App Does Not Do

The current main flow does not:

- Request unlimited token approval.
- Use `approve` plus `transferFrom` as the normal payment path.
- Pull future funds automatically.
- Move funds without the wallet-native confirmation.
- Sponsor gas fees.
- Store payment records in a backend database.
- Restrict access to a private audience.
- Control the final wording shown in Trust Wallet’s native confirmation screen.

## Current Tech Stack

### Frontend

- HTML
- CSS
- Plain JavaScript

### Web3 Layer

- ethers v6 imported from `https://esm.sh/ethers@6.13.5`

### Wallet Integration

- Injected EIP-1193 provider via `window.ethereum`
- Trust Wallet in-app browser is the intended primary runtime

### Blockchain

- BNB Smart Chain mainnet
- Chain ID: `56`
- Hex chain ID: `0x38`

### Token

- USDT on BNB Smart Chain
- Contract address: `0x55d398326f99059fF775485246999027B3197955`

### Merchant Destination

- Merchant name: `StablePay Storefront`
- Merchant address: `0xE69e8962c9b6B7C4e1740a9c39909C8d326494D6`

### Hosting Model

- Static site hosting only
- Suitable for Netlify, Cloudflare Pages, GitHub Pages, or any HTTPS static host

## Project Structure

### `index.html`

Purpose:
Main page structure and all visible UI sections.

Contains:

- Top navigation bar
- Hero section
- Transfer action card
- Logo marquee section
- Feature cards
- Success modal
- Empty-balance modal
- Footer

### `styles.css`

Purpose:
All design, animation, layout, responsive rules, modal visuals, and action-button styling.

Contains:

- Theme variables
- Background effects
- Hero card styling
- Modal styling
- Footer styling
- Responsive breakpoints

### `config.js`

Purpose:
All hardcoded environment-level configuration for chain, merchant, token, explorer, and invoice defaults.

Contains:

- `CHAIN`
- `MERCHANT`
- `TOKEN`
- `DEFAULT_INVOICE`
- `getInvoiceConfig()`
- `shortAddress()`
- `explorerTxUrl()`

### `wallet.js`

Purpose:
Wallet-provider helper functions.

Contains:

- Wallet detection
- ethers `BrowserProvider` creation
- Account request
- Current account read
- Current chain read
- BNB Chain switch
- BNB Chain add fallback
- Wallet event subscription

### `token.js`

Purpose:
Read-only ERC-20 token queries.

Contains:

- `symbol()` read
- `decimals()` read
- `balanceOf()` read
- formatted token state output

### `payment.js`

Purpose:
Transfer-side helpers.

Contains:

- Invoice amount validation
- ERC-20 transfer gas estimation
- Direct ERC-20 `transfer()` submit

### `app.js`

Purpose:
Main runtime controller for the full app.

Contains:

- DOM element cache
- local state object
- status handling
- modal open/close behavior
- invoice synchronization logic
- wallet refresh logic
- send-flow handling
- post-success popup handling
- empty-balance popup handling
- event binding and bootstrapping

### `contracts/MockUSDT.sol`

Purpose:
Test-only ERC-20 used for QA on a test network.

Contains:

- mintable token behavior
- owner model
- approve/transfer/transferFrom support
- balance and allowance storage

### `README.md`

Purpose:
Human-readable project documentation, including this report.

## Chain and Token Configuration

The current production-oriented config is defined in `config.js`.

### Chain

- Name: BNB Smart Chain
- ID: `56`
- Hex ID: `0x38`
- Native currency: BNB
- RPC: `https://bsc-dataseed.binance.org/`
- Explorer: `https://bscscan.com`

### Token

- Symbol: USDT
- Display name: Tether USD
- Address: `0x55d398326f99059fF775485246999027B3197955`

### Merchant

- Name: StablePay Storefront
- Address: `0xE69e8962c9b6B7C4e1740a9c39909C8d326494D6`

### Default Invoice

- Default amount: `1`
- Currency: `USDT`
- Memo: `Order #1048`

### Query String Support

The app supports query string overrides:

```text
https://your-domain.example/?amount=12.50&memo=Order%20%231251
```

Current logic:

- If `amount` is provided in the URL, that amount is treated as fixed.
- If `amount` is not provided, the app later replaces the invoice amount with the full detected USDT wallet balance.

## Detailed Runtime Architecture

### State Model

The runtime state in `app.js` tracks:

- `invoice`
- `account`
- `nativeBalance`
- `token`
- `provider`
- `pending`

This state model drives the UI and transfer decision tree.

### DOM Control Model

`app.js` caches the important DOM elements once at startup, including:

- main button
- invoice display
- status text
- network badge
- success modal controls
- empty-balance modal controls

That means nearly all UI changes are done by updating text, classes, and visibility on already-cached nodes.

## End-to-End Working Flow

### 1. Initial Page Load

When the page loads:

- the app reads invoice config from the URL and defaults
- it initializes the local state object
- it validates the invoice amount
- it checks whether a wallet provider exists
- it binds wallet and UI events
- it tries to refresh wallet state if a provider is already available

### 2. User Clicks the Main Action Button

The main button in the hero card triggers the send flow entry point.

Before doing anything else, the app:

- closes any open success modal
- closes any open empty-balance modal

This avoids stale UI from prior actions.

### 3. Wallet Detection

The app checks for an injected provider.

If none exists:

- the flow stops
- a clear error is shown telling the user to open the app inside Trust Wallet or another wallet browser

### 4. Chain Switching

The app requests a switch to BNB Smart Chain.

If the chain is not already known in the wallet:

- it attempts to add the chain with the configured chain metadata

### 5. Wallet Connection

If the user is not already connected:

- the app requests accounts through `eth_requestAccounts`

If the user rejects:

- the app catches the wallet error and shows a user-friendly message

### 6. Live Balance Refresh

After wallet and chain readiness, the app reads:

- current account address
- current chain ID
- current USDT symbol
- USDT decimals
- USDT balance
- native BNB balance

The USDT read is done through `token.js`.
The BNB read is done through `provider.getBalance(account)`.

### 7. Invoice Amount Syncing

If there is no explicit URL amount override:

- the app updates the invoice amount to the full detected USDT balance

This is why the current app behaves as an “all available USDT” transfer flow when using the default link.

### 8. Readiness Branching

The app then checks several conditions.

#### Branch: Wrong chain

- status says switch to BNB Smart Chain
- token and native balances are cleared

#### Branch: No connected account

- status prompts the user to open Trust Wallet via the button

#### Branch: No USDT

- status says there is no USDT available to send

#### Branch: Insufficient USDT for a fixed invoice amount

- status says insufficient USDT and shows the available amount

#### Branch: No BNB for gas

- status says a small amount of BNB is required to cover the BNB Chain network fee

#### Branch: Ready

- status says the selected amount will open in Trust Wallet confirmation

### 9. Empty-Balance Repeat Flow

If the user taps again after the balance has already gone to zero:

- the app opens the no-balance modal
- the button does not behave like a dead button

This keeps the interaction responsive even after the wallet has already been emptied.

### 10. Transfer Submit Phase

If the wallet is ready to send:

- the app validates the amount again
- computes the raw token amount with decimals
- checks native BNB gas balance
- estimates ERC-20 transfer gas cost

If gas is still insufficient after estimation:

- the flow stops before opening the wallet confirmation

### 11. Native Wallet Confirmation

The actual user approval happens inside Trust Wallet’s native UI.

This is not rendered by the site. The wallet decides:

- the wording
- the button label
- the confirmation layout

The dApp only triggers the token transfer request.

### 12. On-Chain Confirmation

After the user confirms in the wallet:

- the transfer broadcasts
- the app waits for the transaction receipt using `tx.wait()`
- the app checks `receipt.status`

If status is not successful:

- the app throws an error

### 13. Post-Success Refresh

After success:

- balances are refreshed again
- the new wallet state is pulled
- the app updates the success status text
- the app opens the success modal

## Success Modal Behavior

The success modal currently shows:

- title: Payment Confirmed
- amount sent
- merchant address
- transaction hash
- View on BscScan action
- Done button
- Close button

The success modal uses:

- a dark BNB-themed card background
- yellow success icon shell
- stacked detail cards
- explicit close buttons
- body scroll lock while open

Important UX behavior:

- clicking outside the modal does not close it
- keyboard Escape closes it
- explicit buttons close it

## Empty-Balance Modal Behavior

The empty-balance modal appears only when:

- the user has already completed a send
- the wallet has no USDT left
- the user taps the main action button again

It shows:

- title: No USDT Available
- explanation text
- detected balance card
- close action

This exists to preserve a responsive user experience after the wallet has been emptied.

## How the Full-Balance Mode Works

The app supports two invoice modes.

### Fixed Amount Mode

Used when `amount` is supplied in the URL.

Example:

```text
?amount=12.50
```

Behavior:

- the app keeps that exact amount
- readiness checks compare the wallet balance against that fixed value

### Full-Balance Mode

Used when no `amount` is supplied.

Behavior:

- the app reads the wallet’s USDT balance
- formats it using token decimals
- copies that value into `state.invoice.amount`
- later submits that same amount in the transfer call

## Main Functions in `app.js`

### Modal Functions

- `openSuccessModal()`
- `openEmptyBalanceModal()`
- `closeSuccessModal()`
- `closeEmptyBalanceModal()`

These populate and manage the post-transaction UI.

### Invoice Functions

- `getRequiredRawAmount()`
- `formatInvoiceAmount()`
- `resetInvoiceAmount()`
- `syncInvoiceAmountToWalletBalance()`

These functions control how the invoice amount behaves in fixed mode versus full-balance mode.

### UI State Functions

- `setStatus()`
- `setConnectButtonLabel()`
- `updateConnectLabel()`
- `updateButtons()`
- `updateStaticInvoice()`
- `updateConnectedState()`

These keep the UI and runtime state synchronized.

### Runtime / Wallet Functions

- `refreshAssetState()`
- `refreshWalletState()`
- `handleVerifyFlow()`
- `handlePayment()`
- `bindEvents()`
- `init()`

These are the actual engine of the application.

## Wallet Helper Layer

The wallet helper layer in `wallet.js` handles:

- access to the injected wallet provider
- wallet connection requests
- current account reads
- current chain reads
- switching to BNB Smart Chain
- adding BNB Smart Chain if absent
- wallet event subscriptions

This layer is intentionally thin and focused.

## Token Read Layer

The token read layer in `token.js` reads:

- token symbol
- token decimals
- token balance

It returns the token state in both raw and formatted form.

That allows the app to:

- compare balances precisely in raw units
- display balances nicely in human-readable units

## Payment Layer

The payment layer in `payment.js` contains:

- invoice amount validation
- gas estimation for the transfer call
- the direct ERC-20 transfer execution

The core transfer path is:

```text
token.transfer(recipient, parsedAmount)
```

This means the current main payment flow is a standard, explicit ERC-20 transfer.

## Mock Token Contract

`contracts/MockUSDT.sol` exists for QA and testnet simulation.

It includes:

- `mint()`
- `approve()`
- `transfer()`
- `transferFrom()`
- owner transfer
- error-based reverts

Its purpose is test coverage and QA. It is not required for the mainnet production checkout flow.

## Current Visual Design System

The design language is defined in `styles.css`.

### Theme Direction

- Dark background
- BNB gold highlights
- Soft cream/gray typography
- Glassy panels
- Subtle blur and glow effects
- Large rounded corners

### Key Visual Surfaces

- Hero panel
- Hero transfer card
- Logo marquee section
- Feature cards
- Footer section
- Success modal
- Utility modal

### Effects and Motion

- Ambient blurred orbs
- Grid wash background
- Sheen effect on panel surfaces
- Rise-in entrance animation
- Marquee logo motion

## Responsive Design

The app is mobile-first and responsive.

Breakpoints currently exist for:

- small mobile screens
- mid-size tablet screens
- desktop screens

Responsive adjustments include:

- hero text scale
- feature card typography
- modal width and padding
- footer layout changes
- desktop/mobile text variants for some labels

## Public Accessibility and Access Model

Anyone with the deployed link can open this app.

There is currently:

- no login
- no password
- no allowlist
- no hostname restriction
- no backend session control

However, a visitor still cannot complete a transfer unless they:

- have a compatible wallet
- connect the wallet
- are on BNB Smart Chain
- have USDT available
- have BNB for gas
- confirm the transaction in the wallet

## Security and Trust Boundaries

The current mainline flow is intentionally bounded.

### What the user must approve

- wallet connection
- chain switch if needed
- token transfer in the wallet confirmation screen

### What the app cannot bypass

- the wallet’s native confirmation step
- the chain’s gas requirement
- user wallet ownership

### What the wallet controls

- final wording in the native confirmation screen
- button labels such as Approve or Confirm
- exact transaction preview UI

Important note:

The site cannot force Trust Wallet to always show “Confirm” instead of “Approve.” That UI is wallet-controlled, not dApp-controlled.

## Error Cases the App Handles

The current implementation handles:

- wallet not detected
- wallet connection rejected
- chain mismatch
- no connected account
- no USDT available
- insufficient USDT for a fixed amount
- insufficient BNB for gas
- gas-estimate shortfall
- wallet-native confirmation rejection
- mined but unsuccessful transaction
- repeated click after emptying wallet

These are normalized into cleaner messages in `app.js`.

## Current Limitations

The current app does not include:

- backend order persistence
- admin or merchant dashboard
- analytics storage
- user authentication
- gas sponsorship
- multi-token support
- server-side invoice validation
- recurring billing backend
- escrow logic
- custom smart contract settlement

It is intentionally a direct wallet-to-merchant token transfer frontend.

## Run Locally

Use any static server. Example:

```powershell
python -m http.server 4173
```

Then open:

```text
http://localhost:4173/
```

For real wallet testing, use HTTPS or deploy to a staging domain.

## Production Deployment

Recommended production checklist:

1. Upload the project to a static host.
2. Enable HTTPS.
3. Point your domain.
4. Verify merchant address.
5. Verify token address.
6. Test a low-value mainnet transfer.
7. Recheck the success modal and explorer link after live confirmation.

## Testnet QA Process

For QA with a mock token:

1. Deploy `MockUSDT.sol` on BNB Testnet.
2. Mint tokens to a QA wallet.
3. Update config temporarily for testnet.
4. Test connect, balance read, chain switch, send flow, rejection flow, success popup, and empty-balance popup.
5. Switch config back to mainnet only after QA is complete.

## Final Summary

This project is a polished static BNB Chain USDT checkout app with:

- branded landing UI
- Trust Wallet connection
- BNB Smart Chain enforcement
- live USDT and BNB balance reads
- full-wallet-balance send mode by default
- direct wallet-confirmed USDT transfer
- gas preflight validation
- success confirmation popup
- no-balance retry popup

In one line:

StablePay Checkout is a frontend-only BNB Smart Chain USDT transfer experience that turns a normal ERC-20 payment into a branded, responsive, wallet-confirmed checkout flow.
