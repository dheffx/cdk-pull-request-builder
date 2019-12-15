interface EnvironmentVariable {
    name: string,
    value: string
}
type StringMap = { [key: string]: string };

export const getBuildEnvironment = (envVars: EnvironmentVariable[]): StringMap => {
    const buildenv: StringMap = {};
    for (let i = 0, len = envVars.length; i < len; i++) {
        buildenv[envVars[i].name] = envVars[i].value;
    }
    return buildenv;
};

export const isFailedBuild = (buildStatus): boolean  => {
  return (buildStatus !== 'IN_PROGRESS' &&
    buildStatus !== 'SUCCEEDED' &&
    buildStatus !== 'STOPPED');
};
