import { createSupabaseAdmin } from './supabase-admin.mjs';
import { createResponsesExecutor } from './openai-responses.mjs';
import { extractLooseJson } from './openai-responses.mjs';
import { planProductionPipeline } from './production-pipelines.mjs';

const first = (value) => Array.isArray(value) ? value[0] || null : value || null;
const chatSelect = 'id,tenant_id,project_id,channel,role,author_user_id,content,metadata,created_at';
const requestSelect = 'id,tenant_id,customer_id,project_id,created_by,type,title,body,status,priority,metadata,created_at,updated_at';

const safeText = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const normalizeList = (value, max = 12) => Array.isArray(value) ? value.map((item) => safeText(item, 500)).filter(Boolean).slice(0, max) : [];

const proposalFallback = (request, productionPlan) => ({
  overview: `${request.title}について、確定した相談内容に沿って制作を進めます。`,
  approach: '相談内容を実装可能な工程へ分解し、各担当AIが順番に制作・確認を行います。',
  assignees: productionPlan.tasks.map((task) => ({
    role: safeText(task.agent_role || 'AI担当', 120),
    responsibility: safeText(task.title || task.task_key || '担当作業', 300)
  })),
  workItems: productionPlan.tasks.map((task) => ({
    title: safeText(task.title || task.task_key || '作業項目', 200),
    owner: safeText(task.agent_role || 'AI担当', 120),
    description: safeText(task.metadata?.purpose || `${task.phase || '制作'}工程を担当します。`, 700),
    deliverable: safeText(task.metadata?.deliverable || task.title || '工程成果物', 300)
  })),
  acceptanceCriteria: ['確定した相談内容を満たしていること', '品質確認を通過していること', 'お客様確認用プレビューを用意できること'],
  cautions: []
});

const normalizeProposal = (raw, request, productionPlan) => {
  const fallback = proposalFallback(request, productionPlan);
  if (!raw || typeof raw !== 'object') return fallback;
  const assignees = Array.isArray(raw.assignees) ? raw.assignees.map((item) => ({
    role: safeText(item?.role, 120),
    responsibility: safeText(item?.responsibility, 500)
  })).filter((item) => item.role || item.responsibility).slice(0, 12) : fallback.assignees;
  const workItems = Array.isArray(raw.workItems) ? raw.workItems.map((item) => ({
    title: safeText(item?.title, 200),
    owner: safeText(item?.owner, 120),
    description: safeText(item?.description, 900),
    deliverable: safeText(item?.deliverable, 500)
  })).filter((item) => item.title || item.description).slice(0, 16) : fallback.workItems;
  return {
    overview: safeText(raw.overview, 1200) || fallback.overview,
    approach: safeText(raw.approach, 1600) || fallback.approach,
    assignees: assignees.length ? assignees : fallback.assignees,
    workItems: workItems.length ? workItems : fallback.workItems,
    acceptanceCriteria: normalizeList(raw.acceptanceCriteria, 12).length ? normalizeList(raw.acceptanceCriteria, 12) : fallback.acceptanceCriteria,
    cautions: normalizeList(raw.cautions, 8)
  };
};

const proposalText = (proposal) => {
  const lines = ['実装プランをご提案します。', '', proposal.overview, '', `進め方: ${proposal.approach}`];
  if (proposal.assignees.length) {
    lines.push('', '担当者:');
    for (const item of proposal.assignees) lines.push(`- ${item.role}: ${item.responsibility}`);
  }
  if (proposal.workItems.length) {
    lines.push('', '作業内容:');
    for (const item of proposal.workItems) lines.push(`- ${item.title}（担当: ${item.owner || 'AIチーム'}）${item.description ? `: ${item.description}` : ''}`);
  }
  if (proposal.acceptanceCriteria.length) {
    lines.push('', '完了条件:');
    for (const item of proposal.acceptanceCriteria) lines.push(`- ${item}`);
  }
  if (proposal.cautions.length) {
    lines.push('', '確認事項:');
    for (const item of proposal.cautions) lines.push(`- ${item}`);
  }
  lines.push('', '内容をご確認ください。修正したい点があれば、承認前に司令塔AIへそのまま指示できます。');
  return lines.join('\n');
};

const proposalPrompt = ({ request, productionPlan, currentProposal = null, instruction = null }) => `
あなたはアキナエルAIの運営司令塔AIです。
お客様が確定した相談内容を読み、運営者が承認するための「実装前提案」を作ってください。

重要:
- まだ制作は開始しません。これは承認前の提案です。
- 担当者と作業順は、下記の実際のProduction Pipelineを土台にしてください。
- 存在しない担当者や実行できない工程を追加しないでください。
- お客様の確定内容を勝手に広げず、必要なら cautions に確認事項として書いてください。
- 日本語で、管理者が一読で判断できる具体性にしてください。
- 出力はコードフェンスなしのJSON 1個だけにしてください。

JSON形式:
{
  "overview":"今回何を実装するかの要約",
  "approach":"実装方針と作業順",
  "assignees":[{"role":"担当AI/役割","responsibility":"責任範囲"}],
  "workItems":[{"title":"作業名","owner":"担当AI/役割","description":"具体的な作業内容","deliverable":"成果物"}],
  "acceptanceCriteria":["完了条件"],
  "cautions":["確認事項や注意点"]
}

# 確定した相談
タイトル: ${request.title}
種別: ${request.type}
内容:
${request.body}

# 実際に承認後使用されるProduction Pipeline
${JSON.stringify({ pipeline: productionPlan.pipeline, initialPhase: productionPlan.initialPhase, tasks: productionPlan.tasks.map((task) => ({ task_key: task.task_key, title: task.title, agent_role: task.agent_role, phase: task.phase, sequence: task.sequence, mode: task.mode })) }, null, 2)}

${currentProposal ? `# 現在の提案\n${JSON.stringify(currentProposal, null, 2)}` : ''}
${instruction ? `# 管理者からの修正指示\n${instruction}\nこの指示を反映した新しい提案を作ってください。Production Pipelineと矛盾する場合は、無理に反映せず cautions に理由を書いてください。` : ''}
`;

export const createCommanderProposalService = ({ env = process.env, fetchImpl = fetch } = {}) => {
  const admin = createSupabaseAdmin({ env, fetchImpl });
  const responses = createResponsesExecutor({ env, fetchImpl });

  const projectFor = async (projectId) => first(await admin.request('/rest/v1/projects', {
    query: `id=eq.${encodeURIComponent(projectId)}&select=id,tenant_id,customer_id,name,status,needs_attention,attention_reasons&limit=1`
  }));

  const latestRequestFor = async (projectId) => first(await admin.request('/rest/v1/requests', {
    query: `project_id=eq.${encodeURIComponent(projectId)}&select=${requestSelect}&order=created_at.desc&limit=1`
  }));

  const latestProposalRow = async (projectId, requestId = null) => {
    let query = `project_id=eq.${encodeURIComponent(projectId)}&channel=eq.admin_command&metadata->>kind=eq.commander_proposal&select=${chatSelect}&order=created_at.desc&limit=1`;
    if (requestId) query += `&metadata->>requestId=eq.${encodeURIComponent(requestId)}`;
    return first(await admin.request('/rest/v1/ai_chat_messages', { query }));
  };

  const generateProposal = async (request, { currentProposal = null, instruction = null } = {}) => {
    const productionPlan = planProductionPipeline(request);
    const prompt = proposalPrompt({ request, productionPlan, currentProposal, instruction });
    try {
      const run = await responses.run({ prompt, lightweight: false, reasoningEffort: 'medium' });
      const parsed = extractLooseJson(run.output);
      return { proposal: normalizeProposal(parsed, request, productionPlan), model: run.model, productionPlan };
    } catch {
      return { proposal: proposalFallback(request, productionPlan), model: 'fallback', productionPlan };
    }
  };

  const insertProposal = async ({ project, request, proposal, model, actorUserId = null, version = 1 }) => {
    const row = first(await admin.request('/rest/v1/ai_chat_messages', {
      method: 'POST',
      query: `select=${chatSelect}`,
      headers: { Prefer: 'return=representation' },
      body: {
        tenant_id: project.tenant_id,
        project_id: project.id,
        channel: 'admin_command',
        role: 'assistant',
        author_user_id: null,
        content: proposalText(proposal),
        metadata: { kind: 'commander_proposal', requestId: request.id, proposal, version, model, generatedAt: new Date().toISOString(), actorUserId }
      }
    }));
    await admin.request('/rest/v1/projects', {
      method: 'PATCH',
      query: `id=eq.${encodeURIComponent(project.id)}`,
      body: { needs_attention: true, attention_reasons: ['commander_proposal_review'], updated_at: new Date().toISOString() }
    });
    return row;
  };

  const notifyAdmins = async ({ project, request, version }) => {
    const admins = await admin.request('/rest/v1/user_profiles', {
      query: `tenant_id=eq.${encodeURIComponent(project.tenant_id)}&role=eq.admin&select=id`
    });
    for (const profile of Array.isArray(admins) ? admins : []) {
      try {
        await admin.request('/rest/v1/notifications', {
          method: 'POST',
          query: 'on_conflict=idempotency_key&select=id',
          headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: {
            tenant_id: project.tenant_id,
            user_id: profile.id,
            project_id: project.id,
            type: 'commander_proposal_ready',
            message: `${request.title}の実装プランを司令塔AIが提案しました。承認または修正をお願いします。`,
            idempotency_key: `commander_proposal:${request.id}:v${version}`,
            delivery_status: 'in_app',
            delivery_attempts: 0
          }
        });
      } catch {}
    }
  };

  const generateForRequest = async (request) => {
    if (!request?.id || !request?.project_id) return null;
    const existing = await latestProposalRow(request.project_id, request.id);
    if (existing?.metadata?.proposal) return { ...existing.metadata, content: existing.content, createdAt: existing.created_at };
    const project = await projectFor(request.project_id);
    if (!project) return null;
    const generated = await generateProposal(request);
    const row = await insertProposal({ project, request, ...generated, version: 1 });
    await notifyAdmins({ project, request, version: 1 });
    return { ...row.metadata, content: row.content, createdAt: row.created_at };
  };

  const ensureForProject = async (projectId) => {
    const project = await projectFor(projectId);
    if (!project) return null;
    const request = await latestRequestFor(projectId);
    if (!request) return null;
    const existing = await latestProposalRow(projectId, request.id);
    if (existing?.metadata?.proposal) return { ...existing.metadata, content: existing.content, createdAt: existing.created_at };
    if (!['waiting_approval', 'new', 'triaged'].includes(String(request.status || ''))) return null;
    return generateForRequest(request);
  };

  const revise = async ({ projectId, instruction, actorUserId = null }) => {
    const project = await projectFor(projectId);
    const request = await latestRequestFor(projectId);
    if (!project || !request) throw new Error('proposal target not found');
    const currentRow = await latestProposalRow(projectId, request.id);
    const currentProposal = currentRow?.metadata?.proposal || (await generateForRequest(request))?.proposal;
    const currentVersion = Number(currentRow?.metadata?.version || 1);
    await admin.request('/rest/v1/ai_chat_messages', {
      method: 'POST', query: `select=${chatSelect}`, headers: { Prefer: 'return=representation' },
      body: { tenant_id: project.tenant_id, project_id: project.id, channel: 'admin_command', role: 'user', author_user_id: actorUserId, content: safeText(instruction, 4000), metadata: { kind: 'commander_proposal_revision', requestId: request.id, proposalVersion: currentVersion } }
    });
    const generated = await generateProposal(request, { currentProposal, instruction });
    const version = currentVersion + 1;
    const row = await insertProposal({ project, request, ...generated, actorUserId, version });
    await notifyAdmins({ project, request, version });
    return { ...row.metadata, content: row.content, createdAt: row.created_at };
  };

  const approve = async ({ projectId, actorUserId = null }) => {
    const project = await projectFor(projectId);
    const request = await latestRequestFor(projectId);
    if (!project || !request) return null;
    const proposal = await latestProposalRow(projectId, request.id);
    if (!proposal?.metadata?.proposal) return null;
    try {
      await admin.request('/rest/v1/audit_logs', {
        method: 'POST', query: 'select=id', headers: { Prefer: 'return=representation' },
        body: {
          tenant_id: project.tenant_id,
          actor_user_id: actorUserId,
          actor_type: 'admin',
          action: 'commander_proposal_approved',
          resource_type: 'request',
          resource_id: request.id,
          metadata: { project_id: project.id, request_id: request.id, proposal_version: proposal.metadata.version, proposal: proposal.metadata.proposal }
        }
      });
    } catch {}
    return { requestId: request.id, version: proposal.metadata.version, proposal: proposal.metadata.proposal };
  };

  return { generateForRequest, ensureForProject, revise, approve };
};
