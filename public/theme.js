// Chart appearance only. Labels, values, callbacks, series order and scales stay intact.
if (typeof Chart !== 'undefined') {
  const palette = ['#252b20', '#728546', '#54634c', '#929c81', '#b0c185', '#69755d', '#8c9b6a'];
  Chart.defaults.font.family = "'Inter', 'Segoe UI', system-ui, sans-serif";
  Chart.defaults.color = '#697064';
  Chart.register({
    id: 'analyticsAppearance',
    beforeUpdate(chart) {
      const type = chart.config.type;
      for (const [index, dataset] of chart.data.datasets.entries()) {
        if (['doughnut', 'pie', 'polarArea'].includes(type)) {
          dataset.backgroundColor = chart.data.labels.map((_, i) => palette[i % palette.length]);
          dataset.borderColor = '#ffffff';
        } else {
          const color = palette[index % palette.length];
          dataset.borderColor = color;
          dataset.backgroundColor = type === 'line' ? `${color}12` : color;
          dataset.pointBackgroundColor = color;
          dataset.pointBorderColor = '#ffffff';
          dataset.hoverBackgroundColor = color;
        }
      }
      for (const scale of Object.values(chart.options.scales || {})) {
        if (scale.grid) scale.grid.color = '#e9ece4';
        if (scale.ticks) {
          scale.ticks.color = '#697064';
          scale.ticks.font = { ...scale.ticks.font, family: Chart.defaults.font.family };
        }
        if (scale.border) scale.border.color = '#e3e6de';
      }
      const plugins = chart.options.plugins;
      if (plugins.legend && plugins.legend.labels) {
        plugins.legend.labels.color = '#697064';
        plugins.legend.labels.font = { ...plugins.legend.labels.font, family: Chart.defaults.font.family };
      }
      if (plugins.tooltip) {
        plugins.tooltip.backgroundColor = '#191c17';
        plugins.tooltip.titleColor = '#ffffff';
        plugins.tooltip.bodyColor = '#e3ead9';
      }
    },
    afterUpdate(chart) {
      if (chart.canvas.id !== 'chartVentasCustomerHabits') return;
      document.querySelectorAll('#ventasChartLegend > div, #ventasChartLegend > span').forEach((entry, index) => {
        const marker = entry.querySelector('span');
        if (marker) marker.style.background = palette[index % palette.length];
      });
      document.querySelectorAll('#ventasChartStatChips .ventas-chart-stat-chip > span').forEach((marker, index) => {
        marker.style.background = palette[index % palette.length];
      });
    }
  });
}
