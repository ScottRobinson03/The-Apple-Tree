import {
    DescribeExecutionCommand,
    DescribeExecutionCommandOutput,
    GetActivityTaskCommand,
    SFNClient,
    SendTaskSuccessCommand,
    StartExecutionCommand,
    StartExecutionCommandOutput,
} from "@aws-sdk/client-sfn";
import * as dotenv from "dotenv";
import * as path from "path";
import PromptSync from "prompt-sync";
const prompt = PromptSync({ sigint: true });

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

async function sleep(msToSleep: number) {
    await new Promise(r => setTimeout(r, msToSleep));
}

async function startBuyDrinksV2SM() {
    const executionInfo = await sfnClient.send(
        new StartExecutionCommand({
            stateMachineArn: "arn:aws:states:us-east-1:874930755828:stateMachine:BuyDrinkV2",
        })
    );
    console.log(`Execution ${executionInfo.executionArn} started`);
    return executionInfo;
}

async function getActivity() {
    console.log("Getting activity...\n");
    return await sfnClient.send(
        new GetActivityTaskCommand({
            activityArn: "arn:aws:states:us-east-1:874930755828:activity:get-input",
        })
    );
}

async function getExecution(executionArn?: string) {
    if (!executionArn)
        throw new Error("Attempted to describe an execution but didn't pass executionArn");
    return await sfnClient.send(new DescribeExecutionCommand({ executionArn }));
}

async function displayActivity(executionInfo: StartExecutionCommandOutput) {
    const activity = await getActivity();
    if (!activity.taskToken) {
        throw new Error(
            "Failed to fetch activity. Make sure the State Machine has an active execution."
        );
    }

    const activityInput = JSON.parse(activity.input || "{}");
    if (!activityInput.message)
        throw new Error("Activity doesn't have required 'message' field in state's parameters.");

    let response: string | number = prompt(activityInput.message);
    if (activityInput.type === "number") {
        while (isNaN(+response)) {
            console.log("The state machine indicated this input must be a valid number.");
            response = prompt(activityInput.message);
        }
        response = +response;
    }

    await returnTaskToken(activity.taskToken, { response });

    if (!activityInput.finalActivity) {
        await sleep(250); // sleep before checking if input made execution stop (fail)

        const execution = await getExecution(executionInfo.executionArn);
        if (execution.status != "RUNNING") {
            await handleExecutionResult(execution);
            return;
        }
        displayActivity(executionInfo);
    } else await handleExecutionResult(await getExecution(executionInfo.executionArn));
}

async function returnTaskToken(taskToken: string, output: object) {
    return await sfnClient.send(
        new SendTaskSuccessCommand({ taskToken, output: JSON.stringify(output) })
    );
}

async function handleExecutionResult(result: DescribeExecutionCommandOutput) {
    while (result.status === "RUNNING") {
        await new Promise(r => setTimeout(r, 500)); // sleep before trying to fetch execution again

        result = await sfnClient.send(
            new DescribeExecutionCommand({ executionArn: result.executionArn })
        );
    }

    // Work out how long execution took
    if (result.stopDate === undefined || result.startDate === undefined)
        throw new Error("AWS didn't return the execution start and stop timestamps.");

    const duration = result.stopDate.getTime() - result.startDate.getTime();

    // Handle resulting execution status
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
            console.log(); // line-break
            console.log(JSON.parse(output.takeMoneyResult.body).message);
            console.log(JSON.parse(output.serveDrinkResult.body).message);
            break;

        default:
            console.log(result);
            throw new Error(`Unhandled Status: ${result.status}`);
    }
}

startBuyDrinksV2SM()
    .then(executionInfo => displayActivity(executionInfo))
    .catch(err => console.error(err));

// getActivity()
//     .then(activity => console.log(activity))
//     .catch(err => console.error(err));
