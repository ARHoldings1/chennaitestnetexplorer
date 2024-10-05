const express = require('express');
const { Web3 } = require('web3');  // Change this line
const path = require('path');
const app = express();
const port = process.env.PORT || 3001;  // Change 3000 to 3001 or any other available port
const web3 = new Web3(process.env.ETHEREUM_NODE_URL || 'http://3.82.11.145:8545');

// Add this line to set CSP headers
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
    );
    next();
});

// Test connection
web3.eth.net.isListening()
    .then(() => console.log('Connected to Ethereum node'))
    .catch(err => {
        console.error('Failed to connect to Ethereum node:', err);
        console.error('Node URL:', process.env.ETHEREUM_NODE_URL);
        console.error('Detailed error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    });

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

function getTimeDifference(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - Number(timestamp);
    if (diff < 60) return `${diff} secs ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hrs ago`;
    return `${Math.floor(diff / 86400)} days ago`;
}

function calculateTxnFee(tx) {
    const gasPrice = web3.utils.fromWei(tx.gasPrice.toString(), 'ether');
    return (gasPrice * tx.gas).toFixed(8);
}

app.get('/', async (req, res) => {
    try {
        console.log('Attempting to fetch latest block...');
        const latestBlock = await web3.eth.getBlock('latest');
        console.log('Latest block fetched:', latestBlock.number);

        console.log('Fetching last 5 blocks...');
        const latestBlocks = await Promise.all(
            Array.from({length: 5}, (_, i) => web3.eth.getBlock(latestBlock.number - BigInt(i)))
        );
        console.log('Fetched 5 blocks successfully');

        console.log('Fetching latest transactions...');
        const latestTransactions = await Promise.all(
            latestBlock.transactions.slice(0, 10).map(async txHash => {
                const tx = await web3.eth.getTransaction(txHash);
                return {
                    ...tx,
                    value: tx.value.toString(),
                    timestamp: latestBlock.timestamp.toString()
                };
            })
        );
        console.log('Fetched latest transactions successfully');

        const totalTransactions = latestBlocks.reduce((acc, block) => acc + BigInt(block.transactions.length), BigInt(0));
        const averageBlockTime = ((Number(latestBlocks[0].timestamp) - Number(latestBlocks[4].timestamp)) / 4).toFixed(2);

        // Calculate TPS (Transactions Per Second)
        const timeSpan = Number(latestBlocks[0].timestamp) - Number(latestBlocks[4].timestamp);
        const tps = (Number(totalTransactions) / timeSpan).toFixed(2);

        res.render('index', { 
            latestBlock: {
                ...latestBlock,
                number: latestBlock.number.toString(),
                timestamp: latestBlock.timestamp.toString()
            },
            latestBlocks: latestBlocks.map(block => ({
                ...block,
                number: block.number.toString(),
                timestamp: block.timestamp.toString(),
                gasUsed: block.gasUsed.toString(),
                gasLimit: block.gasLimit.toString()
            })),
            latestTransactions,
            totalTransactions: totalTransactions.toString(),
            averageBlockTime,
            tps,
            web3,
            getTimeDifference,
            calculateTxnFee
        });
    } catch (error) {
        console.error('Detailed error in / route:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        res.status(500).send('Error fetching blockchain data: ' + error.message);
    }
});

app.get('/blocks', async (req, res) => {
    try {
        const latestBlock = await web3.eth.getBlock('latest');
        const blocks = await Promise.all(
            Array.from({length: 50}, (_, i) => web3.eth.getBlock(latestBlock.number - BigInt(i)))
        );

        res.render('all-blocks', { 
            blocks: blocks.map(block => ({
                ...block,
                number: block.number.toString(),
                timestamp: block.timestamp.toString(),
                gasUsed: block.gasUsed.toString(),
                gasLimit: block.gasLimit.toString()
            })),
            getTimeDifference
        });
    } catch (error) {
        console.error('Error fetching all blocks:', error);
        res.status(500).send('Error fetching block data');
    }
});

app.get('/transactions', async (req, res) => {
    try {
        const latestBlock = await web3.eth.getBlock('latest');
        const transactions = await Promise.all(
            Array.from({length: 50}, async (_, i) => {
                const block = await web3.eth.getBlock(latestBlock.number - BigInt(i));
                return Promise.all(block.transactions.map(txHash => web3.eth.getTransaction(txHash)));
            })
        );

        const flattenedTransactions = transactions.flat();

        res.render('all-transactions', { 
            transactions: flattenedTransactions.map(tx => ({
                ...tx,
                value: tx.value.toString(),
                timestamp: latestBlock.timestamp.toString()
            })),
            web3,
            getTimeDifference,
            calculateTxnFee
        });
    } catch (error) {
        console.error('Error fetching all transactions:', error);
        res.status(500).send('Error fetching transaction data');
    }
});

app.get('/test', (req, res) => {
    res.send('Test route is working');
});

app.get('/favicon-test', (req, res) => {
    res.sendFile(path.join(__dirname, 'assets', 'favicon.ico'));
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Update the listen method to work with Vercel
if (process.env.VERCEL) {
    // Vercel will handle the listen call
    module.exports = app;
} else {
    app.listen(port, '0.0.0.0', () => {
        console.log(`Explorer app listening at http://0.0.0.0:${port}`);
    });
}

// Move this to the top of the file, after initializing web3
web3.eth.net.isListening()
    .then(() => console.log('Connected to Ethereum node'))
    .catch(err => {
        console.error('Failed to connect to Ethereum node:', err);
        console.error('Node URL:', process.env.ETHEREUM_NODE_URL);
        console.error('Detailed error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    });

app.get('/test-web3', async (req, res) => {
    try {
        console.log('Attempting to connect to Ethereum node...');
        const isListening = await web3.eth.net.isListening();
        console.log('Is listening:', isListening);
        const latestBlock = await web3.eth.getBlockNumber();
        console.log('Latest block:', latestBlock);
        res.json({ isListening, latestBlock, nodeUrl: process.env.ETHEREUM_NODE_URL || 'wss://100.27.255.86:8546' });
    } catch (error) {
        console.error('Error in /test-web3 route:', error);
        console.error('Detailed error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        res.status(500).json({ 
            error: error.message, 
            details: JSON.stringify(error, Object.getOwnPropertyNames(error)),
            nodeUrl: process.env.ETHEREUM_NODE_URL || 'wss://100.27.255.86:8546'
        });
    }
});

module.exports = app;