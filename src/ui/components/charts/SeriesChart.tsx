import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface SeriesChartProps {
  label: string;
  data: readonly { [key: string]: string | number }[];
  xKey: string;
  numericX?: boolean;
  series: readonly { key: string; label: string; color: string }[];
}

/** Shared chart for standings now and experiment measurements later. */
export function SeriesChart({ label, data, xKey, series, numericX = false }: SeriesChartProps) {
  return <div className="series-chart" role="group" aria-label={label}>
    <ResponsiveContainer width="100%" height={250} minWidth={0} initialDimension={{ width: 600, height: 250 }}>
      <LineChart data={[...data]} margin={{ top: 12, right: 20, bottom: 5, left: 0 }} accessibilityLayer>
        <CartesianGrid stroke="#30433e" strokeDasharray="3 5" />
        <XAxis dataKey={xKey} type={numericX ? 'number' : 'category'} domain={numericX ? ['dataMin', 'dataMax'] : undefined} stroke="#a9bcb5" tick={{ fontSize: 10 }} />
        <YAxis stroke="#a9bcb5" tick={{ fontSize: 10 }} width={numericX ? 65 : 35} />
        <Tooltip contentStyle={{ background: '#14221c', border: '1px solid #58764c', color: '#edf5e7' }} />
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 12 }} />
        {series.map((item) => <Line key={item.key} type="linear" dataKey={item.key} name={item.label} stroke={item.color} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer>
    <details className="chart-data"><summary>View chart data</summary><div className="table-scroll"><table><caption>{label}</caption><thead><tr><th scope="col">{xKey}</th>{series.map((item) => <th scope="col" key={item.key}>{item.label}</th>)}</tr></thead><tbody>{data.map((row, index) => <tr key={index}><th scope="row">{row[xKey]}</th>{series.map((item) => <td key={item.key}>{row[item.key] ?? '—'}</td>)}</tr>)}</tbody></table></div></details>
  </div>;
}
