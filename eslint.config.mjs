import parser from '@typescript-eslint/parser'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import importX from 'eslint-plugin-import-x'

export default [
	{ ignores: ['.next/**', 'out/**', 'next-env.d.ts'] },
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: { parser },
		plugins: { 'import-x': importX },
		settings: {
			'import-x/resolver-next': [createTypeScriptImportResolver()]
		},
		rules: {
			'import-x/order': [
				'error',
				{
					groups: [
						'builtin',
						'external',
						'internal',
						'parent',
						'sibling',
						'index',
						'object',
						'type'
					],
					'newlines-between': 'always'
				}
			]
		}
	}
]