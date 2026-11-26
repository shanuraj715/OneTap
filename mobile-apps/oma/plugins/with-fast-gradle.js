const { withGradleProperties } = require("expo/config-plugins");

/**
 * Faster Android builds. The native android/ folder is generated (never edited by hand), so the Gradle settings go in here:
 * build modules in parallel, keep a build cache between builds, and give Gradle enough memory so it does not stall.
 */
const SETTINGS = {
  "org.gradle.parallel": "true",
  "org.gradle.caching": "true",
  "org.gradle.daemon": "true",
  "org.gradle.jvmargs": "-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8",
};

module.exports = function withFastGradle(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(SETTINGS)) {
      const existing = cfg.modResults.find((item) => item.type === "property" && item.key === key);
      if (existing) existing.value = value;
      else cfg.modResults.push({ type: "property", key, value });
    }
    return cfg;
  });
};
