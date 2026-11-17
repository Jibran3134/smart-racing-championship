export interface ExperimentOptions { experiment: '1' | '4' | 'all'; seed: number; runs: number; warmups: number; sizes?: number[] }

export function parseOptions(args: string[]): ExperimentOptions | null {
  if (!args.length || args.length === 1 && ['--help', '--list'].includes(args[0])) return null;
  const options: ExperimentOptions = { experiment: 'all', seed: 20261117, runs: 5, warmups: 2 };
  const used = new Set<string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index], value = args[index + 1];
    if (!['--experiment', '--seed', '--runs', '--warmups', '--sizes'].includes(flag) || value === undefined || used.has(flag)) throw new Error(`Invalid or repeated option: ${flag}. Use --help.`);
    used.add(flag);
    if (flag === '--experiment') { if (!['1', '4', 'all'].includes(value)) throw new Error('Only experiments 1 and 4 are implemented here.'); options.experiment = value as ExperimentOptions['experiment']; }
    else if (flag === '--sizes') {
      if (!/^\d+(,\d+)*$/.test(value)) throw new Error('Sizes must be comma-separated positive integers.');
      options.sizes = value.split(',').map(Number);
      if (options.sizes.length < 2 || options.sizes.length > 8 || new Set(options.sizes).size !== options.sizes.length || options.sizes.some((size) => !Number.isSafeInteger(size) || size < 2 || size > 100000)) throw new Error('Use 2-8 distinct sizes between 2 and 100000. Exploration is capped at 2048.');
      options.sizes.sort((a, b) => a - b);
    } else {
      if (!/^\d+$/.test(value)) throw new Error(`Invalid integer for ${flag}.`);
      const number = Number(value);
      if (!Number.isSafeInteger(number)) throw new Error(`Invalid integer for ${flag}.`);
      if (flag === '--seed') options.seed = number;
      if (flag === '--runs') options.runs = number;
      if (flag === '--warmups') options.warmups = number;
    }
  }
  if (options.seed > 0xffffffff || options.runs < 5 || options.runs > 30 || options.warmups < 1 || options.warmups > 10) throw new Error('Use uint32 seed, 5-30 measured runs and 1-10 warm-up runs.');
  if (options.sizes?.some((size) => size > (options.experiment === '4' ? 100000 : 2048))) throw new Error('Exploration sizes are capped at 2048.');
  return options;
}
