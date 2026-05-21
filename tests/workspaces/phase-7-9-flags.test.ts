import test from "node:test";
import assert from "node:assert/strict";

import { isFeatureEnabled, requireFeatureEnabled, FeatureDisabledError } from "../../src/lib/feature-flags";

test("phase 7-9 feature flags exist", () => {
  // Just verify the flags exist and return a boolean
  const studyMaterials = isFeatureEnabled("studyMaterials");
  const teacherAnalytics = isFeatureEnabled("teacherAnalytics");
  const ogcodePublishing = isFeatureEnabled("ogcodePublishing");
  assert.equal(typeof studyMaterials, "boolean");
  assert.equal(typeof teacherAnalytics, "boolean");
  assert.equal(typeof ogcodePublishing, "boolean");
});

test("phase 7-9 feature flags can be enabled via env vars", () => {
  const originalStudyMaterials = process.env.TEACHER_LAUNCH_STUDY_MATERIALS;
  const originalTeacherAnalytics = process.env.TEACHER_LAUNCH_TEACHER_ANALYTICS;
  const originalOgcodePublishing = process.env.TEACHER_LAUNCH_OGCODE_PUBLISHING;

  try {
    process.env.TEACHER_LAUNCH_STUDY_MATERIALS = "1";
    process.env.TEACHER_LAUNCH_TEACHER_ANALYTICS = "true";
    process.env.TEACHER_LAUNCH_OGCODE_PUBLISHING = "on";

    assert.equal(isFeatureEnabled("studyMaterials"), true);
    assert.equal(isFeatureEnabled("teacherAnalytics"), true);
    assert.equal(isFeatureEnabled("ogcodePublishing"), true);
  } finally {
    process.env.TEACHER_LAUNCH_STUDY_MATERIALS = originalStudyMaterials;
    process.env.TEACHER_LAUNCH_TEACHER_ANALYTICS = originalTeacherAnalytics;
    process.env.TEACHER_LAUNCH_OGCODE_PUBLISHING = originalOgcodePublishing;
  }
});

test("requireFeatureEnabled throws FeatureDisabledError when flag is off", () => {
  const original = process.env.TEACHER_LAUNCH_STUDY_MATERIALS;
  try {
    process.env.TEACHER_LAUNCH_STUDY_MATERIALS = "0";
    assert.throws(() => requireFeatureEnabled("studyMaterials"), FeatureDisabledError);
  } finally {
    process.env.TEACHER_LAUNCH_STUDY_MATERIALS = original;
  }
});

test("requireFeatureEnabled does not throw when flag is on", () => {
  const original = process.env.TEACHER_LAUNCH_STUDY_MATERIALS;
  try {
    process.env.TEACHER_LAUNCH_STUDY_MATERIALS = "1";
    assert.doesNotThrow(() => requireFeatureEnabled("studyMaterials"));
  } finally {
    process.env.TEACHER_LAUNCH_STUDY_MATERIALS = original;
  }
});
