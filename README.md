# Gartic Phone Flooder

A simple script to flood a Gartic Phone game with bots. It's interesting if you want to make the game annoying for other players.

## Requirements

- [Node.js](https://nodejs.org/en/download/) or [Bun](https://bun.sh/)

## Usage

1. Clone the repository

```bash
git clone https://github.com/JustYuuto/gartic-phone-flooder.git
```
2. Install dependencies

```bash
npm install
# or with bun
bun install
```

3. Modify the config file in `config.json`

```json
{
  "username": "bot"
}
```

4. Run the script

```bash
node . <the game link> <the number of bots>
```

## Example

```bash
# 25 bots will join the game
node . https://garticphone.com/?c=0160bf6918 25
```