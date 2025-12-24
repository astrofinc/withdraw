const RPC_URL = 'https://eclipse.lgns.net/';
const PROGRAM_ID = 'Astro1oWvtB7cBTwi3efLMFB47WXx7DJDQeoxi235kA';
const GROUP_ID = '8GzZHDKts3oHeL91h4fYjbjaAcUicBb8NB6ZTLTHvYr6';

const BANK_METADATA = {
    'D7zkaUgFUDkhQHExySRxokL3Fa1GFnnuiVDTs9yMrFHY': { symbol: 'SOL', name: 'Wrapped SOL' },
    '7NeDyW6MA7zLdTWDbctFoXfJ6vSQX7YvtBh7EbdXqDi9': { symbol: 'USDC', name: 'USD Coin' },
    '5UYMqm6tSdkukzmYnpDXgKbiL7vgv7cKgHCjqk8NfRRa': { symbol: 'ETH', name: 'WETH Coin' },
    '633omaAVadPpcewGpnsPWtzDjPhEugmfTg8mrfHihL8H': { symbol: 'tETH', name: 'Turbo Ethereum' },
    'BkYdo4sGdCD3oXKQtLtZhuySkfT5hZb3act8CDC7s5rj': { symbol: 'TIA', name: 'Celestia' },
    'AtYiVYtKndtFqgyqtHgZ3swvBYBkTvc7ajNgkJJQKnty': { symbol: 'tUSD', name: 'Turbo USD' },
    'CDg7SA5Pxf6MTLbqTJgsVD6aLzcj2Q43vAKQBscsuSgq': { symbol: 'ES', name: 'Eclipse' }
};

const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new solanaWeb3.PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const ASSOCIATED_TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const PYTH_PUSH_ORACLE_ID = new solanaWeb3.PublicKey('pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT');
const PYTH_SPONSORED_SHARD_ID = 0;
const MARGINFI_SPONSORED_SHARD_ID = 3301;
const NATIVE_MINT = new solanaWeb3.PublicKey('So11111111111111111111111111111111111111112');

const ERROR_CODES = {
    "\"Custom\":1}": "Not enough funds",
    6000: "Math error",
    6001: "Invalid bank index",
    6002: "Lending account balance not found",
    6003: "Bank deposit capacity exceeded",
    6004: "Invalid transfer",
    6005: "Missing Pyth or Bank account",
    6006: "Missing Pyth account",
    6007: "Invalid Pyth account",
    6008: "Missing Bank account",
    6009: "Invalid Bank account",
    6010: "RiskEngine rejected due to either bad health or stale oracles",
    6011: "Lending account balance slots are full",
    6012: "Bank already exists",
    6013: "Illegal liquidation",
    6014: "Account is not bankrupt",
    6015: "Account balance is not bad debt",
    6016: "Invalid group config",
    6017: "Stale oracle data",
    6018: "Bank paused",
    6019: "Bank is ReduceOnly mode",
    6020: "Bank is missing",
    6021: "Operation is deposit-only",
    6022: "Operation is withdraw-only",
    6023: "Operation is borrow-only",
    6024: "Operation is repay-only",
    6025: "No asset found",
    6026: "No liability found",
    6027: "Invalid oracle setup",
    6028: "Invalid bank utilization ratio",
    6029: "Bank borrow cap exceeded",
    6030: "Invalid Price",
    6031: "Account can have only one liability when account is under isolated risk",
    6032: "Emissions already setup",
    6033: "Oracle is not set",
    6034: "Invalid switchboard decimal conversion",
    6035: "Cannot close balance because of outstanding emissions",
    6036: "Update emissions error",
    6037: "Account disabled",
    6038: "Account can't temporarily open 3 balances, please close a balance first",
    6039: "Illegal action during flashloan",
    6040: "Illegal flashloan",
    6041: "Illegal flag",
    6042: "Illegal balance state",
    6043: "Illegal account authority transfer",
    6044: "Unauthorized",
    6045: "Invalid account authority",
    6046: "Token22 Banks require mint account as first remaining account"
};

function formatErrorMessage(errorMessage) {
    if (!errorMessage) return errorMessage;

    for (const [code, msg] of Object.entries(ERROR_CODES)) {
        if (errorMessage.includes(code)) {
            return msg;
        }
    }

    return errorMessage;
}

let connection = null;
let wallet = null;
let program = null;
let idl = null;
let accounts = [];
let banks = new Map();
let currentAccount = null;

async function init() {
    try {
        await new Promise((resolve) => {
            if (window.Buffer) {
                resolve();
            } else {
                window.addEventListener('bufferLoaded', resolve, { once: true });
                setTimeout(() => resolve(), 3000);
            }
        });

        await new Promise((resolve) => {
            if (window.Decimal) {
                resolve();
            } else {
                window.addEventListener('decimalLoaded', resolve, { once: true });
                setTimeout(() => resolve(), 3000);
            }
        });

        let attempts = 0;
        while (typeof window.BigNumber === 'undefined' && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (typeof window.BigNumber === 'undefined') {
            if (typeof BigNumber !== 'undefined') {
                window.BigNumber = BigNumber;
            } else {
                showStatus('walletStatus', 'BigNumber library not loaded. Please refresh the page.', 'error');
                return;
            }
        }
        if (typeof window.Decimal === 'undefined') {
            if (typeof Decimal !== 'undefined') {
                window.Decimal = Decimal;
            } else {
                showStatus('walletStatus', 'Decimal library not loaded. Please refresh the page.', 'error');
                return;
            }
        }

        await new Promise((resolve) => {
            if (window.anchor) {
                resolve();
            } else {
                window.addEventListener('anchorLoaded', resolve, { once: true });
                setTimeout(() => {
                    if (!window.anchor) {
                        showStatus('walletStatus', 'Anchor library failed to load. Please refresh the page.', 'error');
                    }
                    resolve();
                }, 5000);
            }
        });

        if (typeof window.Buffer === 'undefined' || typeof window.anchor === 'undefined') {
            showStatus('walletStatus', 'Required libraries not loaded. Please refresh the page.', 'error');
            return;
        }

        const idlResponse = await fetch('./idl.json');
        idl = await idlResponse.json();
        idl.address = PROGRAM_ID;

        connection = new solanaWeb3.Connection(RPC_URL, 'confirmed');

        document.getElementById('connectBtn').addEventListener('click', connectWallet);
        document.getElementById('accountSelect').addEventListener('change', onAccountChange);
    } catch (error) {
        console.error('Initialization error:', error);
        showStatus('walletStatus', 'Failed to initialize: ' + error.message, 'error');
    }
}

async function connectWallet() {
    try {
        if (!window.backpack?.solana) {
            showStatus('walletStatus', 'Backpack wallet not found. Please install Backpack extension.', 'error');
            return;
        }

        const provider = window.backpack.solana;
        await provider.connect();

        wallet = {
            publicKey: new solanaWeb3.PublicKey(provider.publicKey),
            signTransaction: async (tx) => await provider.signTransaction(tx),
            signAllTransactions: async (txs) => await provider.signAllTransactions(txs)
        };

        const anchorProvider = new window.anchor.AnchorProvider(
            connection,
            wallet,
            { commitment: 'confirmed' }
        );
        program = new window.anchor.Program(idl, anchorProvider);

        showStatus('walletStatus', `Connected: ${wallet.publicKey.toBase58().slice(0, 8)}...`, 'success');
        document.getElementById('connectBtn').textContent = 'Connected';
        document.getElementById('connectBtn').disabled = true;

        await loadAccounts();
    } catch (error) {
        console.error('Wallet connection error:', error);
        showStatus('walletStatus', 'Connection failed: ' + error.message, 'error');
    }
}

async function loadAccounts() {
    try {
        showStatus('accountStatus', 'Loading accounts...', 'info');

        const groupPk = new solanaWeb3.PublicKey(GROUP_ID);
        const authorityPk = wallet.publicKey;

        const accountInfos = await program.account.astrolendAccount.all([
            {
                memcmp: {
                    bytes: groupPk.toBase58(),
                    offset: 8
                }
            },
            {
                memcmp: {
                    bytes: authorityPk.toBase58(),
                    offset: 8 + 32
                }
            }
        ]);

        accounts = accountInfos.map(acc => ({
            address: acc.publicKey,
            data: acc.account
        }));

        if (accounts.length === 0) {
            showStatus('accountStatus', 'No accounts found for this wallet.', 'error');
            return;
        }

        const select = document.getElementById('accountSelect');
        select.innerHTML = '';
        accounts.forEach((acc, idx) => {
            const option = document.createElement('option');
            option.value = idx;
            option.textContent = `Account ${idx + 1}: ${acc.address.toBase58()}...`;
            select.appendChild(option);
        });

        document.getElementById('accountSection').style.display = 'block';
        await onAccountChange();
    } catch (error) {
        console.error('Load accounts error:', error);
        showStatus('accountStatus', 'Failed to load accounts: ' + error.message, 'error');
    }
}

async function onAccountChange() {
    const select = document.getElementById('accountSelect');
    const idx = parseInt(select.value);
    if (idx < 0 || idx >= accounts.length) return;

    currentAccount = accounts[idx];
    await loadAccountBalances();
}

async function loadAccountBalances() {
    try {
        showStatus('accountStatus', 'Loading balances...', 'info');

        const accountData = await program.account.astrolendAccount.fetch(currentAccount.address);
        currentAccount.data = accountData;

        await loadBanks();
        displayBalances();
    } catch (error) {
        console.error('Load balances error:', error);
        showStatus('accountStatus', 'Failed to load balances: ' + error.message, 'error');
    }
}

async function loadBanks() {
    const bankAddresses = Object.keys(BANK_METADATA);
    const bankInfos = await connection.getMultipleAccountsInfo(
        bankAddresses.map(addr => new solanaWeb3.PublicKey(addr))
    );

    banks.clear();
    bankAddresses.forEach((addr, idx) => {
        if (bankInfos[idx]) {
            banks.set(addr, {
                address: new solanaWeb3.PublicKey(addr),
                metadata: BANK_METADATA[addr]
            });
        }
    });
}

async function displayBalances() {
    const BigNumber = window.BigNumber;
    const Decimal = window.Decimal;

    if (!BigNumber || !Decimal) {
        showStatus('accountStatus', 'Required libraries not loaded. Please refresh the page.', 'error');
        return;
    }

    const bankList = document.getElementById('bankList');
    bankList.innerHTML = '';

    if (!currentAccount || !currentAccount.data) {
        bankList.innerHTML = '<div class="loading">No account data</div>';
        return;
    }

    const balances = currentAccount.data.lendingAccount.balances || [];
    const allBankAddresses = Object.keys(BANK_METADATA);
    const bankDataMap = new Map();

    for (const bankAddress of allBankAddresses) {
        try {
            const bankPk = new solanaWeb3.PublicKey(bankAddress);
            const bankData = await program.account.bank.fetch(bankPk);
            bankDataMap.set(bankAddress, bankData);
        } catch (e) {
            console.error(`Error loading bank ${bankAddress}:`, e);
        }
    }

    for (const bankAddress of allBankAddresses) {
        const bank = banks.get(bankAddress);
        if (!bank) continue;

        const bankData = bankDataMap.get(bankAddress);
        if (!bankData) continue;

        const balance = balances.find(b => b.active && b.bankPk.toString() === bankAddress);

        let balanceAmount = new BigNumber(0);
        let hasWithdrawableBalance = false;
        let hasDebt = false;

        if (balance) {
            const assetShares = wrappedI80F48toBigNumber(balance.assetShares);
            const assetShareValue = wrappedI80F48toBigNumber(bankData.assetShareValue);
            const assetQuantity = assetShares.times(assetShareValue);

            if (assetQuantity.gt(0)) {
                balanceAmount = assetQuantity.dividedBy(new BigNumber(10).pow(bankData.mintDecimals));
                hasWithdrawableBalance = true;
            } else {
                const liabilityShares = wrappedI80F48toBigNumber(balance.liabilityShares);
                const liabilityShareValue = wrappedI80F48toBigNumber(bankData.liabilityShareValue);
                const liabilityQuantity = liabilityShares.times(liabilityShareValue);

                if (liabilityQuantity.gt(0)) {
                    balanceAmount = liabilityQuantity.dividedBy(new BigNumber(10).pow(bankData.mintDecimals));
                    hasDebt = true;
                }
            }
        }

        const bankItem = document.createElement('div');
        bankItem.className = 'bank-item';

        const bankInfo = document.createElement('div');
        bankInfo.className = 'bank-info';
        const displayText = hasWithdrawableBalance ?
            `Deposited: ${balanceAmount.toFixed(6)} ${bank.metadata.name}` :
            hasDebt ?
                `Owed: ${balanceAmount.toFixed(6)} ${bank.metadata.name}` :
                'No balance';
        bankInfo.innerHTML = `
        <div class="bank-symbol">${bank.metadata.symbol}</div>
        <div class="bank-balance">${displayText}</div>
    `;

        const actionBtn = document.createElement('button');
        if (hasWithdrawableBalance) {
            actionBtn.textContent = 'Withdraw All';
            actionBtn.onclick = () => withdrawFromBank(bankAddress, bankData);
        } else if (hasDebt) {
            actionBtn.textContent = 'Repay All';
            actionBtn.onclick = () => repayToBank(bankAddress, bankData);
        } else {
            actionBtn.textContent = 'Withdraw All';
            actionBtn.disabled = true;
        }

        bankItem.appendChild(bankInfo);
        bankItem.appendChild(actionBtn);
        bankList.appendChild(bankItem);
    }

    if (bankList.children.length > 0) {
        document.getElementById('banksSection').style.display = 'block';
    }

    showStatus('accountStatus', 'Balances loaded', 'success');
}

function wrappedI80F48toBigNumber(wrapped) {
    const BigNumber = window.BigNumber;
    const Decimal = window.Decimal;

    if (!BigNumber || !Decimal) {
        throw new Error('BigNumber or Decimal library not loaded');
    }

    if (!wrapped || !wrapped.value) return new BigNumber(0);

    const I80F48_FRACTIONAL_BYTES = 6;
    const I80F48_TOTAL_BYTES = 16;
    const I80F48_DIVISOR = new Decimal(2).pow(8 * I80F48_FRACTIONAL_BYTES);

    let bytesLE = wrapped.value;
    if (bytesLE.length !== I80F48_TOTAL_BYTES) {
        throw new Error(`Expected a ${I80F48_TOTAL_BYTES}-byte buffer`);
    }

    let bytesBE = bytesLE.slice();
    bytesBE.reverse();

    let signChar = "";
    const msb = bytesBE[0];
    if (msb & 0x80) {
        signChar = "-";
        bytesBE = bytesBE.map((v) => ~v & 0xff);
    }

    let hex = signChar + "0x" + bytesBE.map((v) => v.toString(16).padStart(2, "0")).join("");
    let decoded = new Decimal(hex).dividedBy(I80F48_DIVISOR);

    return new BigNumber(decoded.toString());
}

function findPythPushOracleAddress(feedId, programId, shardId) {
    const shardBytes = new Uint8Array(2);
    const view = new DataView(shardBytes.buffer);
    view.setUint16(0, shardId, true);

    let feedIdBuffer;
    try {
        if (feedId instanceof solanaWeb3.PublicKey) {
            feedIdBuffer = feedId.toBuffer();
        } else if (feedId instanceof Uint8Array || (feedId && feedId.buffer instanceof ArrayBuffer)) {
            feedIdBuffer = feedId;
        } else if (typeof feedId === 'string') {
            feedIdBuffer = new solanaWeb3.PublicKey(feedId).toBuffer();
        } else if (feedId && typeof feedId.toBase58 === 'function') {
            const feedIdPk = new solanaWeb3.PublicKey(feedId.toBase58());
            feedIdBuffer = feedIdPk.toBuffer();
        } else if (feedId && feedId._bn) {
            const feedIdPk = new solanaWeb3.PublicKey(feedId);
            feedIdBuffer = feedIdPk.toBuffer();
        } else {
            const feedIdPk = new solanaWeb3.PublicKey(feedId);
            feedIdBuffer = feedIdPk.toBuffer();
        }
    } catch (e) {
        console.error('Error converting feedId to buffer:', feedId, e);
        throw new Error(`Failed to convert feedId to buffer: ${e.message}`);
    }

    const [address] = solanaWeb3.PublicKey.findProgramAddressSync(
        [shardBytes, feedIdBuffer],
        programId
    );
    return address;
}

async function findOracleKey(bankConfig) {
    const oracleSetupRaw = bankConfig.oracleSetup;
    const oracleSetupType = Object.keys(oracleSetupRaw || {})[0] || '';

    let oracleKeyRaw = bankConfig.oracleKeys && bankConfig.oracleKeys.length > 0
        ? bankConfig.oracleKeys[0]
        : null;

    if (!oracleKeyRaw) return null;

    let oracleKey;
    if (oracleKeyRaw instanceof solanaWeb3.PublicKey) {
        oracleKey = oracleKeyRaw;
    } else if (typeof oracleKeyRaw === 'string') {
        oracleKey = new solanaWeb3.PublicKey(oracleKeyRaw);
    } else {
        try {
            oracleKey = new solanaWeb3.PublicKey(oracleKeyRaw);
        } catch (e) {
            console.error('Failed to convert oracleKey to PublicKey:', oracleKeyRaw, e);
            return null;
        }
    }

    if (oracleSetupType.toLowerCase() === 'pythpushoracle') {
        const mfiOracle = findPythPushOracleAddress(
            oracleKey,
            PYTH_PUSH_ORACLE_ID,
            MARGINFI_SPONSORED_SHARD_ID
        );
        const pythOracle = findPythPushOracleAddress(
            oracleKey,
            PYTH_PUSH_ORACLE_ID,
            PYTH_SPONSORED_SHARD_ID
        );

        const mfiInfo = await connection.getAccountInfo(mfiOracle);
        if (mfiInfo) {
            return mfiOracle;
        }

        const pythInfo = await connection.getAccountInfo(pythOracle);
        if (pythInfo) {
            return pythOracle;
        }

        return mfiOracle;
    }

    return oracleKey;
}

async function getAssociatedTokenAddress(mint, owner, allowOwnerOffCurve = false, programId = null) {
    const pid = programId ? new solanaWeb3.PublicKey(programId) : TOKEN_PROGRAM_ID;

    if (!allowOwnerOffCurve && !solanaWeb3.PublicKey.isOnCurve(owner.toBuffer())) {
        throw new Error('Invalid owner key');
    }

    const [address] = await solanaWeb3.PublicKey.findProgramAddress(
        [owner.toBuffer(), pid.toBuffer(), mint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return address;
}

function createAssociatedTokenAccountInstruction(payer, ata, owner, mint, programId = null) {
    const pid = programId ? new solanaWeb3.PublicKey(programId) : TOKEN_PROGRAM_ID;

    const keys = [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: ata, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: pid, isSigner: false, isWritable: false },
    ];

    return new solanaWeb3.TransactionInstruction({
        keys,
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        data: Buffer.alloc(0)
    });
}

async function withdrawFromBank(bankAddress, bankDataParam = null) {
    try {
        const bankPk = new solanaWeb3.PublicKey(bankAddress);
        showStatus('accountStatus', 'Preparing withdrawal...', 'info');

        let bankData = bankDataParam;
        if (!bankData) {
            bankData = await program.account.bank.fetch(bankPk);
        }
        const mint = new solanaWeb3.PublicKey(bankData.mint);
        const mintDecimals = bankData.mintDecimals;

        const mintAccountInfo = await connection.getAccountInfo(mint);
        if (!mintAccountInfo) {
            throw new Error('Mint account not found');
        }
        const tokenProgramId = mintAccountInfo.owner;

        const accountData = await program.account.astrolendAccount.fetch(currentAccount.address);
        const balances = accountData.lendingAccount.balances || [];
        const balance = balances.find(b => b.active && b.bankPk.toString() === bankAddress);

        const assetShares = wrappedI80F48toBigNumber(balance.assetShares);
        const assetShareValue = wrappedI80F48toBigNumber(bankData.assetShareValue);
        const assetQuantity = assetShares.times(assetShareValue);

        const userAta = await getAssociatedTokenAddress(mint, wallet.publicKey, true, tokenProgramId);
        const ataInfo = await connection.getAccountInfo(userAta);
        const instructions = [];

        if (!ataInfo) {
            const createAtaIx = createAssociatedTokenAccountInstruction(
                wallet.publicKey,
                userAta,
                wallet.publicKey,
                mint,
                tokenProgramId.toBase58()
            );
            instructions.push(createAtaIx);
        }

        const activeBalances = balances.filter(b => b.active);
        const remainingAccounts = [];

        if (tokenProgramId.equals(TOKEN_2022_PROGRAM_ID)) {
            remainingAccounts.push({
                pubkey: mint,
                isSigner: false,
                isWritable: false
            });
        }

        const banksToInclude = activeBalances
            .filter(b => !b.bankPk.equals(bankPk))
            .map(b => b.bankPk);

        for (const bankAddress of banksToInclude) {
            try {
                const bankAccountData = await program.account.bank.fetch(bankAddress);
                remainingAccounts.push({
                    pubkey: bankAddress,
                    isSigner: false,
                    isWritable: false
                });

                try {
                    const oracleKey = await findOracleKey(bankAccountData.config);
                    if (oracleKey) {
                        remainingAccounts.push({
                            pubkey: oracleKey,
                            isSigner: false,
                            isWritable: false
                        });
                    }
                } catch (e) {
                    if (bankAccountData.config && bankAccountData.config.oracleKeys && bankAccountData.config.oracleKeys.length > 0) {
                        try {
                            const fallbackKeyRaw = bankAccountData.config.oracleKeys[0];
                            let fallbackKey;

                            if (fallbackKeyRaw instanceof solanaWeb3.PublicKey) {
                                fallbackKey = fallbackKeyRaw;
                            } else if (typeof fallbackKeyRaw === 'string') {
                                fallbackKey = new solanaWeb3.PublicKey(fallbackKeyRaw);
                            } else {
                                fallbackKey = new solanaWeb3.PublicKey(fallbackKeyRaw);
                            }

                            if (fallbackKey && !fallbackKey.equals(solanaWeb3.PublicKey.default)) {
                                remainingAccounts.push({
                                    pubkey: fallbackKey,
                                    isSigner: false,
                                    isWritable: false
                                });
                            }
                        } catch (fallbackError) {
                            console.error(`Failed to add oracle for bank ${bankAddress.toBase58()}:`, fallbackError);
                        }
                    }
                }
            } catch (e) {
                console.warn(`Failed to fetch bank data for ${bankAddress.toBase58()}:`, e);
            }
        }

        const nativeAmount = assetQuantity.toFixed(0);

        const withdrawIx = await program.methods
            .lendingAccountWithdraw(
                new window.anchor.BN(nativeAmount),
                true
            )
            .accounts({
                astrolendGroup: new solanaWeb3.PublicKey(GROUP_ID),
                astrolendAccount: currentAccount.address,
                signer: wallet.publicKey,
                bank: bankPk,
                destinationTokenAccount: userAta,
                tokenProgram: tokenProgramId
            })
            .remainingAccounts(remainingAccounts)
            .instruction();

        instructions.push(withdrawIx);

        const { blockhash } = await connection.getLatestBlockhash();
        const transaction = new solanaWeb3.Transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        transaction.add(...instructions);

        showStatus('accountStatus', 'Simulating transaction...', 'info');

        try {
            const simulation = await connection.simulateTransaction(transaction);
            if (simulation.value.err) {
                console.error('Withdraw simulation failed:', simulation.value);
                if (simulation.value.logs) {
                    console.log('Program logs:', simulation.value.logs.join('\n'));
                }
                throw new Error('Simulation failed: ' + JSON.stringify(simulation.value.err));
            }
        } catch (simError) {
            console.error('Withdraw simulation error:', simError);
            showStatus('accountStatus', 'Simulation error: ' + formatErrorMessage(simError.message), 'error');
            return;
        }

        showStatus('accountStatus', 'Signing transaction...', 'info');
        const signed = await wallet.signTransaction(transaction);

        showStatus('accountStatus', 'Sending transaction...', 'info');
        const signature = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
            maxRetries: 3
        });

        showStatus('accountStatus', `Transaction sent: ${signature}. Confirming...`, 'info');
        await connection.confirmTransaction(signature, 'confirmed');

        showStatus('accountStatus', `Withdrawal successful! Signature: ${signature}`, 'success');
        setTimeout(() => loadAccountBalances(), 2000);

    } catch (error) {
        console.error('Withdrawal error:', error);
        showStatus('accountStatus', 'Withdrawal failed: ' + error.message, 'error');
    }
}

async function repayToBank(bankAddress, bankDataParam = null) {
    try {
        const bankPk = new solanaWeb3.PublicKey(bankAddress);
        showStatus('accountStatus', 'Preparing repayment...', 'info');

        let bankData = bankDataParam;
        if (!bankData) {
            bankData = await program.account.bank.fetch(bankPk);
        }
        const mint = new solanaWeb3.PublicKey(bankData.mint);
        const mintDecimals = bankData.mintDecimals;

        const mintAccountInfo = await connection.getAccountInfo(mint);
        if (!mintAccountInfo) {
            throw new Error('Mint account not found');
        }
        const tokenProgramId = mintAccountInfo.owner;

        const accountData = await program.account.astrolendAccount.fetch(currentAccount.address);
        const balances = accountData.lendingAccount.balances || [];
        const balance = balances.find(b => b.active && b.bankPk.toString() === bankAddress);
        if (!balance) {
            throw new Error('No active balance found for this bank');
        }

        const liabilityShares = wrappedI80F48toBigNumber(balance.liabilityShares);
        const liabilityShareValue = wrappedI80F48toBigNumber(bankData.liabilityShareValue);
        const liabilityQuantity = liabilityShares.times(liabilityShareValue);
        const nativeAmountRoundedUp = new BigNumber(Math.ceil(Number(liabilityQuantity.toString())));

        const userAta = await getAssociatedTokenAddress(mint, wallet.publicKey, true, tokenProgramId);
        const ataInfo = await connection.getAccountInfo(userAta);
        const isNativeMint = mint.equals(NATIVE_MINT);
        const instructions = [];

        let userBalance = new BigNumber(0);
        if (ataInfo) {
            const accountData = ataInfo.data;
            const dataView = new DataView(accountData.buffer, accountData.byteOffset, accountData.byteLength);
            const balance = dataView.getBigUint64(64, true);
            userBalance = new BigNumber(balance.toString());
        }

        const requiredAmount = nativeAmountRoundedUp;

        if (userBalance.lt(requiredAmount)) {
            if (isNativeMint) {
                if (!ataInfo) {
                    const createAtaIx = createAssociatedTokenAccountInstruction(
                        wallet.publicKey,
                        userAta,
                        wallet.publicKey,
                        mint,
                        tokenProgramId.toBase58()
                    );
                    instructions.push(createAtaIx);
                }

                const amountToWrap = requiredAmount.minus(userBalance);
                const amountToWrapRoundedUp = new BigNumber(Math.ceil(Number(amountToWrap.toString())));

                const transferIx = solanaWeb3.SystemProgram.transfer({
                    fromPubkey: wallet.publicKey,
                    toPubkey: userAta,
                    lamports: Number(amountToWrapRoundedUp.toString())
                });
                instructions.push(transferIx);

                const syncNativeIx = new solanaWeb3.TransactionInstruction({
                    keys: [{ pubkey: userAta, isSigner: false, isWritable: true }],
                    programId: tokenProgramId,
                    data: Buffer.from([17])
                });
                instructions.push(syncNativeIx);
            }
        }

        const activeBalances = balances.filter(b => b.active);
        const remainingAccounts = [];

        if (tokenProgramId.equals(TOKEN_2022_PROGRAM_ID)) {
            remainingAccounts.push({
                pubkey: mint,
                isSigner: false,
                isWritable: false
            });
        }

        const banksToInclude = activeBalances
            .filter(b => !b.bankPk.equals(bankPk))
            .map(b => b.bankPk);

        for (const bankAddress of banksToInclude) {
            try {
                const bankAccountData = await program.account.bank.fetch(bankAddress);
                remainingAccounts.push({
                    pubkey: bankAddress,
                    isSigner: false,
                    isWritable: false
                });

                try {
                    const oracleKey = await findOracleKey(bankAccountData.config);
                    if (oracleKey) {
                        remainingAccounts.push({
                            pubkey: oracleKey,
                            isSigner: false,
                            isWritable: false
                        });
                    }
                } catch (e) {
                    if (bankAccountData.config && bankAccountData.config.oracleKeys && bankAccountData.config.oracleKeys.length > 0) {
                        try {
                            const fallbackKeyRaw = bankAccountData.config.oracleKeys[0];
                            let fallbackKey;

                            if (fallbackKeyRaw instanceof solanaWeb3.PublicKey) {
                                fallbackKey = fallbackKeyRaw;
                            } else if (typeof fallbackKeyRaw === 'string') {
                                fallbackKey = new solanaWeb3.PublicKey(fallbackKeyRaw);
                            } else {
                                fallbackKey = new solanaWeb3.PublicKey(fallbackKeyRaw);
                            }

                            if (fallbackKey && !fallbackKey.equals(solanaWeb3.PublicKey.default)) {
                                remainingAccounts.push({
                                    pubkey: fallbackKey,
                                    isSigner: false,
                                    isWritable: false
                                });
                            }
                        } catch (fallbackError) {
                            console.error(`Failed to add oracle for bank ${bankAddress.toBase58()}:`, fallbackError);
                        }
                    }
                }
            } catch (e) {
                console.warn(`Failed to fetch bank data for ${bankAddress.toBase58()}:`, e);
            }
        }

        const repayIx = await program.methods
            .lendingAccountRepay(
                new window.anchor.BN(nativeAmountRoundedUp.toString()),
                true
            )
            .accounts({
                astrolendGroup: new solanaWeb3.PublicKey(GROUP_ID),
                astrolendAccount: currentAccount.address,
                signer: wallet.publicKey,
                bank: bankPk,
                signerTokenAccount: userAta,
                tokenProgram: tokenProgramId
            })
            .remainingAccounts(remainingAccounts)
            .instruction();

        instructions.push(repayIx);

        const { blockhash } = await connection.getLatestBlockhash();
        const transaction = new solanaWeb3.Transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        transaction.add(...instructions);

        showStatus('accountStatus', 'Simulating transaction...', 'info');

        try {
            const simulation = await connection.simulateTransaction(transaction);
            if (simulation.value.err) {
                console.error('Repay simulation failed:', simulation.value);
                if (simulation.value.logs) {
                    console.log('Program logs:', simulation.value.logs.join('\n'));
                }
                throw new Error('Simulation failed: ' + JSON.stringify(simulation.value.err));
            }
        } catch (simError) {
            console.error('Repay simulation error:', simError);
            showStatus('accountStatus', 'Simulation error: ' + formatErrorMessage(simError.message), 'error');
            return;
        }

        showStatus('accountStatus', 'Signing transaction...', 'info');
        const signed = await wallet.signTransaction(transaction);

        showStatus('accountStatus', 'Sending transaction...', 'info');
        const signature = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
            maxRetries: 3
        });

        showStatus('accountStatus', `Transaction sent: ${signature}. Confirming...`, 'info');
        await connection.confirmTransaction(signature, 'confirmed');

        showStatus('accountStatus', `Repayment successful! Signature: ${signature}`, 'success');
        setTimeout(() => loadAccountBalances(), 2000);

    } catch (error) {
        console.error('Repayment error:', error);
        showStatus('accountStatus', 'Repayment failed: ' + error.message, 'error');
    }
}

function showStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = 'status ' + type;
    element.style.display = 'block';
}

function showMainContent() {
    const guideOverlay = document.getElementById('guideOverlay');
    const mainContent = document.getElementById('mainContent');
    guideOverlay.style.display = 'none';
    mainContent.classList.add('visible');
}

document.getElementById('guideOkBtn').addEventListener('click', showMainContent);

init();
