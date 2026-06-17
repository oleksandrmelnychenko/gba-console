import { parseThemeColor, useMantineTheme } from '@mantine/core'
import { useCallback } from 'react'

export function useChartColor() {
  const theme = useMantineTheme()

  return useCallback(
    (color: string | undefined, fallback = 'var(--mantine-color-gray-6)'): string => {
      if (!color) {
        return fallback
      }

      if (color.startsWith('var(') || color.startsWith('#') || color.startsWith('rgb')) {
        return color
      }

      const parsed = parseThemeColor({ color, theme })

      return parsed.value || fallback
    },
    [theme],
  )
}
