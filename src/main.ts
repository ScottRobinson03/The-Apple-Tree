import { Drink, ServeDrinkInput } from "./types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    // BatchWriteCommand,
    DynamoDBDocumentClient,
    // PutCommand,
    ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import * as dotenv from "dotenv";
import * as path from "path";
import PromptSync from "prompt-sync";
import { runServeDrinkSFN } from "./sfn";
const prompt = PromptSync({ sigint: true });

dotenv.config({ path: path.join(__dirname, "../.env") });

if (!(process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY)) {
    throw new Error("Failed to load AWS Credentials");
}

const ddbdClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({
        credentials: {
            accessKeyId: process.env.ACCESS_KEY_ID,
            secretAccessKey: process.env.SECRET_ACCESS_KEY,
        },
        region: "us-east-1",
    })
);

// async function insertDrinks() {
//     const drinks: Drink[] = [
//         {
//             name: "Diet Coke",
//             cost: 2.1,
//             alcoholic: false,
//         },
//         {
//             name: "Diet Lemonade",
//             cost: 2.1,
//             alcoholic: false,
//         },
//         {
//             name: "Apple Juice",
//             cost: 1.8,
//             alcoholic: false,
//         },
//         {
//             name: "J20 Orange & Passionfruit",
//             cost: 2.3,
//             alcoholic: false,
//         },
//         {
//             name: "Mixed Fruit Kopparberg",
//             cost: 3.0,
//             alcoholic: true,
//         },
//         {
//             name: "Southern Comfort & Lemonade",
//             cost: 3.7,
//             alcoholic: true,
//         },
//         {
//             name: "White Zinfandel (175ml)",
//             cost: 4.25,
//             alcoholic: true,
//         },
//     ];

//     if (drinks.length > 25) throw new Error("Need to update code to insert in groups of 25");

//     const response = await ddbdClient.send(
//         new BatchWriteCommand({
//             RequestItems: {
//                 drinks: drinks.map(drink => {
//                     return {
//                         PutRequest: {
//                             Item: drink,
//                         },
//                     };
//                 }),
//             },
//         })
//     );
//     return response
// }

// insertDrinks()
//     .then(res => console.log(res))
//     .catch(err => console.error(err));

async function getDrinks() {
    return (await ddbdClient.send(new ScanCommand({ TableName: "drinks" }))).Items as Drink[];
}

async function getChosenDrink() {
    const drinks = await getDrinks();
    console.table(
        drinks.map(drink => {
            return {
                name: drink.name,
                cost: `£${drink.cost.toFixed(2)}`,
                alcohlic: ["no", "yes"][+drink.alcoholic],
            };
        })
    );

    let chosenDrink: Drink;
    while (true) {
        const indexChoice = prompt("Enter the index of the drink you'd like: ");
        if (isNaN(+indexChoice) || +indexChoice < 0 || +indexChoice > drinks.length - 1) {
            console.log("That's not a valid index. Please try again.\n");
            continue;
        }
        chosenDrink = drinks[+indexChoice];
        break;
    }
    console.log(`\nYou've selected ${chosenDrink.name}`);
    return chosenDrink;
}

function getAge() {
    let age: number;
    while (true) {
        const ageString = prompt(
            "\nPlease enter your age to confirm you can purchase alcoholic beverages: "
        );
        if (isNaN(+ageString) || +ageString < 0 || +ageString > 122) {
            console.log("That's not a valid age. Please try again.\n");
            continue;
        }
        age = +ageString;
        break;
    }
    return age;
}

function getBalance() {
    let balance: number;
    while (true) {
        const balanceString = prompt(
            "\nPlease enter your balance to confirm you have enough money to purchase this drink: £"
        );
        if (isNaN(+balanceString) || +balanceString < 0) {
            console.log("That's not a valid balance. Please try again.");
            continue;
        }
        balance = +balanceString;
        break;
    }
    return balance;
}

async function main() {
    const chosenDrink = await getChosenDrink();
    const age = chosenDrink.alcoholic ? getAge() : null;
    const balance = getBalance();

    const result = await runServeDrinkSFN(
        {
            drink: chosenDrink,
            buyer: { age, balance },
        } as ServeDrinkInput,
        "prod-run"
    );

    if (result.stopDate === undefined || result.startDate === undefined)
        throw new Error("AWS didn't return the execution start and stop timestamps.");

    const duration = result.stopDate.getTime() - result.startDate.getTime();

    switch (result.status) {
        case "TIMED_OUT":
            console.log(`Request timed out after ${duration}ms. Try again later.`);
            break;

        case "ABORTED":
            console.log(`Request was aborted after ${duration}ms. Try again later.`);
            break;

        case "FAILED":
            console.log(
                `Request failed after ${duration}ms with error ${result.error} (${result.cause})`
            );
            break;

        case "SUCCEEDED":
            console.log(`Request succeeded after ${duration}ms.`);

            if (result.output === undefined) {
                console.log("ERR: can't display info as AWS didn't return output");
                break;
            }
            const output = JSON.parse(result.output);
            console.log(JSON.parse(output.takeMoneyResult.body).message);
            console.log(JSON.parse(output.transactionInfo.body).message);
            break;

        default:
            console.log(result);
            throw new Error(`Unhandled Status: ${result.status}`);
    }
}

main().catch(err => console.error(err));
