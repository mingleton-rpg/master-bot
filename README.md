# Jimothy (master-bot)
> The primary bot used for interacting with the Mingleton RPG. Handles account creation, inventory management, airdrops, and factions.

## High-level description
### Airdrops
- Called randomly throughout the day, Airdrops provide a random amount of dollars to the first person/people to claim them. Airdrops behaviour is defined in `json/config.json`, and modifiable behaviour includes the name, range of payout, the maximum number of claimants, and the expiration of the Airdrop.
- The frequency of Airdrops is determined by the number of Online and DnD users who have the Mingleton RPG role (as defined by `bot:roleID` in `json/config.json`). A graph depicting this frequency can be seen [here](https://www.desmos.com/calculator/gtb2zddoe6).

### Inventory
- A standardised inventory module is implemented to display all of a user's items, as well as a few basic actions.
- Item information, attributes and possible actions are handled by the API server; see that repository for more information.

### Factions
- Factions allow users to join groups that have their own private Discord channel and leaderboard.
- **Factions are invite only:** only members of the faction can invite new members, and prospecting members must accept via a DM from the master bot.
- Users can only exist within one faction at a time; to create or join another faction, they must first leave the one they are in.
