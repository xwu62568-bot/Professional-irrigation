import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
function asTextContent(name, data, note) {
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    tool: name,
                    note,
                    data,
                }, null, 2),
            },
        ],
    };
}
export function createServer(client) {
    const server = new McpServer({
        name: 'irrigation-platform',
        version: '0.1.0',
    });
    server.tool('get_overview', '获取当前平台概览数据', {}, async () => {
        const data = await client.getOverview();
        return asTextContent('get_overview', data);
    });
    server.tool('list_fields', '列出当前账号可见的地块', {}, async () => {
        const data = await client.listFields();
        return asTextContent('list_fields', data);
    });
    server.tool('get_field_detail', '读取单个地块详情', {
        fieldId: z.string().min(1),
    }, async ({ fieldId }) => {
        const data = await client.getFieldDetail(fieldId);
        return asTextContent('get_field_detail', data);
    });
    server.tool('list_devices', '列出设备，可选择是否包含演示设备', {
        includeDemo: z.boolean().default(true),
    }, async ({ includeDemo }) => {
        const data = await client.listDevices(includeDemo);
        return asTextContent('list_devices', data);
    });
    server.tool('get_device_detail', '读取单个设备详情', {
        deviceId: z.string().min(1),
    }, async ({ deviceId }) => {
        const data = await client.getDeviceDetail(deviceId);
        return asTextContent('get_device_detail', data);
    });
    server.tool('list_plans', '列出灌溉计划', {}, async () => {
        const data = await client.listPlans();
        return asTextContent('list_plans', data);
    });
    server.tool('get_plan_detail', '读取单个灌溉计划详情', {
        planId: z.string().min(1),
    }, async ({ planId }) => {
        const data = await client.getPlanDetail(planId);
        return asTextContent('get_plan_detail', data);
    });
    server.tool('start_plan', '启动一个灌溉计划。该工具会触发真实执行，请谨慎调用。', {
        planId: z.string().min(1),
    }, async ({ planId }) => {
        const data = await client.startPlan(planId);
        return asTextContent('start_plan', data, 'This action triggers a real plan run.');
    });
    server.tool('stop_plan', '停止一个灌溉计划。该工具会提交真实停止请求，请谨慎调用。', {
        planId: z.string().min(1),
    }, async ({ planId }) => {
        const data = await client.stopPlan(planId);
        return asTextContent('stop_plan', data, 'This action requests the running plan to stop.');
    });
    server.tool('control_device', '控制演示设备开关阀。该工具会下发真实控制命令，请谨慎调用。', {
        deviceId: z.string().min(1),
        action: z.enum(['open', 'close']),
        stationIndex: z.number().int().nonnegative(),
        durationSeconds: z.number().int().positive().default(60),
    }, async ({ deviceId, action, stationIndex, durationSeconds }) => {
        const data = await client.controlDevice({
            deviceId,
            action,
            stationIndex,
            durationSeconds,
        });
        return asTextContent('control_device', data, 'This action sends a real device command.');
    });
    return server;
}
