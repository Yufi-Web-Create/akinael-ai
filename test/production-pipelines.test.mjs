import test from 'node:test';
import assert from 'node:assert/strict';
import { planProductionPipeline, productionPipelineCatalog } from '../src/production-pipelines.mjs';

test('web_new uses full research-first autonomous pipeline', () => {
  const plan = planProductionPipeline({ type: 'web_new' });
  assert.equal(plan.pipeline, 'web_new_full');
  assert.equal(plan.metadata.autonomous_until, 'deploy_ready');
  assert.equal(plan.metadata.research_required, true);
  assert.equal(plan.metadata.dynamic_expansion, false);
  assert.equal(plan.tasks[0].task_key, 'intake_spec');
  assert.equal(plan.tasks.at(-1).task_key, 'release_gate');

  const build = plan.tasks.find((item) => item.task_key === 'build');
  assert.deepEqual(build.depends_on, ['copy_direction', 'design_direction']);
  const direction = plan.tasks.find((item) => item.task_key === 'direction_synthesis');
  assert.deepEqual(direction.depends_on.sort(), ['copy_language_research', 'design_reference_research', 'market_ux_research'].sort());

  const designResearchIndex = plan.tasks.findIndex((item) => item.task_key === 'design_reference_research');
  const designDirectionIndex = plan.tasks.findIndex((item) => item.task_key === 'design_direction');
  assert.ok(designResearchIndex < designDirectionIndex);
});

test('web_change starts with impact triage instead of blindly running the full research pipeline', () => {
  const plan = planProductionPipeline({ type: 'web_change' });
  assert.equal(plan.pipeline, 'web_change_adaptive');
  assert.equal(plan.metadata.dynamic_expansion, true);
  assert.equal(plan.metadata.expansion_rule, 'web_change_impact');
  assert.deepEqual(plan.tasks.map((item) => item.task_key), ['change_intake', 'change_impact_triage']);
});

test('copy always researches language before drafting', () => {
  const plan = planProductionPipeline({ type: 'copy' });
  assert.equal(plan.pipeline, 'copy_research');
  const research = plan.tasks.findIndex((item) => item.task_key === 'copy_research');
  const create = plan.tasks.findIndex((item) => item.task_key === 'copy_create');
  assert.ok(research >= 0 && research < create);
});

test('general and unknown requests use dynamic consultation triage', () => {
  for (const type of ['general', 'unexpected']) {
    const plan = planProductionPipeline({ type });
    assert.equal(plan.pipeline, 'consultation_triage');
    assert.equal(plan.metadata.dynamic_expansion, true);
  }
});

test('all planned task keys are unique and sequences are stable', () => {
  for (const type of Object.keys(productionPipelineCatalog())) {
    const plan = planProductionPipeline({ type });
    const keys = plan.tasks.map((item) => item.task_key);
    assert.equal(new Set(keys).size, keys.length, `duplicate task key in ${type}`);
    assert.deepEqual(plan.tasks.map((item) => item.sequence), plan.tasks.map((_item, index) => index + 1));
  }
});
