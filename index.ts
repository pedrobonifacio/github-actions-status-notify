import { Octokit } from "octokit";
import { clearIntervalAsync, setIntervalAsync } from "set-interval-async";
import notifier from "node-notifier";
import "dotenv/config";
import readline from "readline";

function main(args: string[], branch: string) {
  return new Promise(async (resolve, reject) => {
    try {
      let { OWNER, REPO, GITHUB_TOKEN } = process.env;
      args.forEach((arg, index) => {
        switch (arg) {
          case "--owner":
            if (!args[index + 1]) {
              throw new Error("--owner require a value");
            }
            OWNER = args[index + 1];
            break;
          case "--repo":
            if (!args[index + 1]) {
              throw new Error("--repo require a value");
            }
            REPO = args[index + 1];
            break;
          case "--branch":
            if (!args[index + 1]) {
              throw new Error("--branch require a value");
            }
            branch = args[index + 1];
            break;
          case "--token":
            if (!args[index + 1]) {
              throw new Error("--token require a value");
            }
            GITHUB_TOKEN = args[index + 1];
            break;
        }
      });

      if (OWNER && REPO && branch && GITHUB_TOKEN) {
        const getPrUrl = (obj: Record<string, any>) =>
          `https://github.com/${OWNER}/${REPO}/pull/${obj?.number}`;

        const octokit = new Octokit({
          auth: GITHUB_TOKEN,
        });
        let status: "success" | "failure" | "pending";
        const getStatus = (workflow_runs: Record<string, any>[]) => {
          if (workflow_runs.find((wor) => wor.conclusion === null))
            return "pending";
          else if (workflow_runs.find((wor) => wor.conclusion === "failure"))
            return "failure";
          else return "success";
        };
        const timer = setIntervalAsync(async () => {
          const workflows = await octokit.request(
            "GET /repos/{owner}/{repo}/actions/runs",
            {
              owner: OWNER!,
              repo: REPO!,
              branch,
            }
          );

          const newStatus = getStatus(
            workflows.data.workflow_runs.filter(
              (wor) => wor.head_sha === workflows.data.workflow_runs[0].head_sha
            )
          );

          if (status !== newStatus) {
            const pr0 = workflows.data.workflow_runs[0].pull_requests?.[0];

            notifier.notify({
              title: `Github Actions - ${branch}`,
              message: `Status: ${newStatus}`,
              sound: true,
              subtitle: branch,
              open: pr0 ? getPrUrl(pr0!) : undefined,
            });
          }
          status = newStatus;

          if (newStatus === "success" || newStatus === "failure") {
            resolve(0);
            await clearIntervalAsync(timer);
          }
        }, 5000);
      } else {
        throw new Error("missing env variables");
      }
    } catch (err) {
      reject(err);
    }
  });
}
const start = (branch = process.env.BRANCH) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  main(process.argv, branch!)
    .then(() => {
      rl.question(`branch: ${branch && `(${branch})`} `, (branchInp) => {
        const branchInpf = !!branchInp.trim() ? branchInp.trim() : branch;
        start(branchInpf);
      });
    })
    .catch((err) => {
      console.error(err);
      console.info("Tente outra branch.");
      rl.question(`branch: ${branch && `(${branch})`} `, (branchInp) => {
        const branchInpf = !!branchInp.trim() ? branchInp.trim() : branch;
        start(branchInpf);
      });
    });
};

start();
