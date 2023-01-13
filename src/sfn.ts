import {
    SFNClient,
    StartSyncExecutionCommand,
    // StartSyncExecutionCommandOutput,
} from "@aws-sdk/client-sfn";
import { ServeDrinkInput } from "./types";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

if (!(process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY)) {
    throw new Error("Failed to load AWS Credentials");
}

const sfnClient = new SFNClient({
    credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
    },
    region: "us-east-1",
});

async function executeStateMachine(
    stateMachineArn: string,
    input: string,
    executionName: string | undefined
) {
    return await sfnClient.send(
        new StartSyncExecutionCommand({
            stateMachineArn,
            input,
            name: executionName,
        })
    );
}

// async function getExecutionResult(executionArn: string) {
//     let executionResult = await getExecutionInfo(executionArn);
//     while (executionResult.status === "RUNNING") {
//         // Haven't slept long enough for the execution to finish, so sleep for another 0.5 seconds
//         console.log("Haven't slept long enough, so sleeping for another 0.5 seconds");
//         await sleep(500);
//         executionResult = await getExecutionInfo(executionArn); // we know it's not undefined since function handles
//     }
//     return executionResult;
// }

// async function getExecutionInfo(executionArn: string) {
//     return await sfnClient.send(new DescribeExecutionCommand({ executionArn }));
// }

export async function runServeDrinkSFN(inputToSFN: ServeDrinkInput, executionName?: string) {
    return await executeStateMachine(
        "arn:aws:states:us-east-1:874930755828:stateMachine:BuyDrink",
        JSON.stringify(inputToSFN),
        executionName
    );
}

// function getMessageParts(executionResult: StartSyncExecutionCommandOutput) {
//     const executionMsg = `Execution '${executionResult.name}'`;

//     let statusMessage;
//     let addToEnd = "";
//     switch (executionResult.status) {
//         case "ABORTED":
//             statusMessage = "was aborted";
//             break;

//         case "TIMED_OUT":
//             statusMessage = "has timed out";
//             break;

//         case "FAILED":
//             statusMessage = `failed with error ${executionResult.error}`;
//             addToEnd = `\nCause: ${executionResult.cause}`;
//             break;

//         case "SUCCEEDED":
//             statusMessage = "succeeded";
//             addToEnd = `\nOutput:\n${executionResult.output}`;
//             break;

//         default:
//             throw new Error(`Unexpected Status: '${executionResult.status}'`);
//     }

//     const executionDuration =
//         (executionResult.stopDate?.getTime() as number) -
//         (executionResult.startDate?.getTime() as number);
//     const durationMsg = `after ${executionDuration}ms.`;

//     return [executionMsg, statusMessage, durationMsg, addToEnd];
// }

// function handleExecutionResult(executionResult: StartSyncExecutionCommandOutput) {
//     console.log(executionResult);

//     // Validate that key values which should exist, do exist
//     for (let [key, value] of Object.entries(executionResult)) {
//         if (["mapRunARN", "traceHeader"].includes(key)) continue; // we don't care about these keys being undefined

//         if (value === undefined) {
//             if (
//                 // There's no error or cause when execution succeeds
//                 (["error", "cause"].includes(key) && executionResult.status === "SUCCEEDED") ||
//                 // There's no output (or outputDetails) when the execution DOESN'T succeed
//                 (key.includes("output") && executionResult.status !== "SUCCEEDED")
//             )
//                 continue;

//             throw new Error(
//                 `AWS didn't return the execution's ${key}` +
//                     (executionResult.name ? ` for execution '${executionResult.name}'.` : ".")
//             );
//         }
//     }
//     // Output message based on execution result
//     console.log(getMessageParts(executionResult).join(" "));
// }

// runServeDrinkSFN(
//     {
//         buyer: { balance: 2.0, age: 15 },
//         drink: { name: "Mixed Fruit Kopparberg", cost: 2.0, alcoholic: true },
//     },
//     "test-underage-from-vscode"
// )
//     .then(handleExecutionResult)
//     .catch(err => console.error(err));
