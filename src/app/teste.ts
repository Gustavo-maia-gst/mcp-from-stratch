import { exec } from "child_process";
import { McpServer, McpStreamType, Tool } from "../mcpStream/decorators";
import { promisify } from "util";

const execAsync = promisify(exec);

@McpServer({
  type: McpStreamType.HTTP,
  serverName: "Kubernetes MCP",
  version: "0.0.1",
  port: 3000,
})
export class Teste {
  @Tool({
    name: "pods.list",
    description: "List all pods",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description:
            "The namespace to list the pods from, omit to list all namespaces",
          pattern: "^[^[a-zA-Z0-9\\\\-_]*$",
        },
      },
    },
  })
  public async listPods(params: { namespace?: string }) {
    const namespace = params.namespace
      ? ` --namespace ${params.namespace}`
      : "-A";

    const command = `kubectl get pods ${namespace}`;

    const result = await execAsync(command);
    const output = result.stdout.trim().replace(/ +/g, ",");

    return output;
  }

  @Tool({
    name: "pods.describe",
    description: "Describe a pod",
    inputSchema: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "The namespace of the pod to describe",
          pattern: "^[a-zA-Z0-9\\\\-_]+$",
        },
        pod: {
          type: "string",
          description: "The name of the pod to describe",
          pattern: "^[a-zA-Z0-9\\-_]+$",
        },
      },
      required: ["namespace", "pod"],
    },
  })
  public async describePod(params: { namespace: string; pod: string }) {
    const command = `kubectl describe pod ${params.pod} -n ${params.namespace}`;

    const result = await execAsync(command);
    const output = result.stdout.trim().replace(/ +/g, ",");

    return output;
  }
}
