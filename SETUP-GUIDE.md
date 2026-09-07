# Setting Up Your LiveLogger Lite Test — Step by Step

Do these in order. Nothing here requires experience — just follow each step exactly.

---

## Step 1: Unzip the app folder
- **Mac:** double-click `dailylog-app.zip`
- **Windows:** right-click it → "Extract All"

You now have a folder called `dailylog-app`. Remember where it is (probably your Downloads folder).

---

## Step 2: Install Node.js
This is a free program your computer needs so it can run the app's brain.

1. Go to **nodejs.org**
2. Click the big download button (it will say **LTS**)
3. Open the file it downloads and click Next → Next → Finish, like installing anything else

You only ever do this once.

---

## Step 3: Open a terminal inside the app folder
A "terminal" is just a plain text window where you type commands instead of clicking buttons. This is the one new skill here.

**On a Mac:**
1. Press Cmd+Space, type "Terminal," hit Enter
2. In the Terminal window, type `cd ` — that's "c," "d," then one space — and don't press Enter yet
3. Drag the `dailylog-app` folder from Finder into the Terminal window. It'll paste the folder's location automatically.
4. Now press Enter

**On Windows:**
1. Open File Explorer and go into the `dailylog-app` folder
2. Click once in the address bar at the top of the window (where the folder path is shown)
3. Type `cmd` and press Enter
4. A black window opens — it's already pointed at the right folder

---

## Step 4: Install the app's pieces
In that same terminal window, type exactly this and press Enter:

```
npm install
```

Text will scroll for a bit — 10 to 30 seconds. That's normal, not an error. When it stops scrolling and gives you a fresh empty line, it's done.

---

## Step 5: Get your AI key
This is a separate account from your regular Claude subscription — it's a pay-as-you-go account that lets this app talk to Claude directly.

1. Go to **console.anthropic.com**
2. Sign up and add a card (testing this costs pennies, not a subscription fee)
3. Click **API Keys** → **Create Key**
4. Copy the long string of letters and numbers it gives you — this is your key, keep it private like a password

---

## Step 6: Give the app your key
1. Inside the `dailylog-app` folder, find the file named `.env.example`
2. Make a copy of it
3. Rename that copy to exactly `.env` — delete the `.example` part entirely
4. Open `.env` in Notepad (Windows) or TextEdit (Mac)
5. Find the line that says `your-key-here` and replace it with the key you copied in Step 5
6. Save the file

---

## Step 7: Turn the app on
Back in your terminal window, type exactly this and press Enter:

```
npm start
```

You'll see a message with a web address in it, something like:
```
http://localhost:3000
```

---

## Step 8: Open it and test
Copy that address, paste it into your regular web browser (Chrome, Safari, whatever you normally use), and press Enter. The app opens. Try dictating a fake day and hitting Save Report.

---

## Turning it off / back on later
- **To stop it:** click into the terminal window and press `Ctrl+C`
- **To start it again another day:** you only need to repeat **Step 7** (`npm start`) — everything else stays set up
