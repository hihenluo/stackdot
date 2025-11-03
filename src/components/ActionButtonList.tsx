'use client'
import { useDisconnect, useAppKit, useAppKitNetwork, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react'
import { useAppKitConnection, type Provider } from '@reown/appkit-adapter-solana/react'
import { networks } from '@/config'

import {
  SystemProgram,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js'

function deserializeCounterAccount(data?: Buffer): { count: number } {
  if (data?.byteLength !== 8) {
    throw Error('Need exactly 8 bytes to deserialize counter')
  }
  return {
    count: Number(data[0])
  }
}

export const ActionButtonList = () => {
    const { disconnect } = useDisconnect();
    const { open } = useAppKit();
    const { switchNetwork } = useAppKitNetwork();

    const { address } = useAppKitAccount();
    const { connection } = useAppKitConnection();
    const { walletProvider } = useAppKitProvider<Provider>('solana');

    const handleDisconnect = async () => {
      try {
        await disconnect();
      } catch (error) {
        console.error("Failed to disconnect:", error);
      }
    }

    async function onIncrementCounter() {
      if (!walletProvider || !connection) {
        alert("Please connect your wallet first.");
        console.error("Wallet provider or connection not found.");
        return;
      }

      console.log("Starting transaction...");

      try {
        const PROGRAM_ID = new PublicKey('Cb5aXEgXptKqHHWLifvXu5BeAuVLjojQ5ypq6CfQj1hy');
        const counterKeypair = Keypair.generate();
        const counter = counterKeypair.publicKey;

        const balance = await connection.getBalance(walletProvider.publicKey);
        if (balance < LAMPORTS_PER_SOL / 100) {
          throw Error('Not enough SOL in wallet');
        }

        const COUNTER_ACCOUNT_SIZE = 8;
        const allocIx: TransactionInstruction = SystemProgram.createAccount({
          fromPubkey: walletProvider.publicKey,
          newAccountPubkey: counter,
          lamports: await connection.getMinimumBalanceForRentExemption(COUNTER_ACCOUNT_SIZE),
          space: COUNTER_ACCOUNT_SIZE,
          programId: PROGRAM_ID
        });

        const incrementIx: TransactionInstruction = new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            {
              pubkey: counter,
              isSigner: false,
              isWritable: true
            }
          ],
          data: Buffer.from([0x0])
        });

        const tx = new Transaction().add(allocIx).add(incrementIx);
        tx.feePayer = walletProvider.publicKey;
        tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
        
        console.log("Sending transaction...");
        await walletProvider.signAndSendTransaction(tx, [counterKeypair]);

        const counterAccountInfo = await connection.getAccountInfo(counter, {
          commitment: 'confirmed'
        });

        if (!counterAccountInfo) {
          throw new Error('Expected counter account to have been created');
        }

        const counterAccount = deserializeCounterAccount(counterAccountInfo?.data);
        if (counterAccount.count !== 1) {
          throw new Error('Expected count to have been 1');
        }

        const successMessage = `[alloc+increment] count is: ${counterAccount.count}`;
        console.log(successMessage);
        alert(`Success! Count is: ${counterAccount.count}`);

      } catch (error) {
        console.error("Failed to increment counter:", error);
        alert(`Error: ${error.message}`);
      }
    }

  return (
    <div>
        <button onClick={() => open()}>Open</button>
        <button onClick={handleDisconnect}>Disconnect</button>
        <button onClick={() => switchNetwork(networks[1]) }>Switch</button>
        
        <button onClick={onIncrementCounter}>Increment Counter</button>
    </div>
  )
}