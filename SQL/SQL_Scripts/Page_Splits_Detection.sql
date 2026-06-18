SELECT
	[AllocUnitName] AS N'Index',
	(CASE [Context]
		WHEN N'LCX_INDEX_LEAF' THEN N'Nonclustered'
		WHEN N'LCX_CLUSTERED' THEN N'Clustered'
		ELSE N'Non-Leaf'
	END) AS [SplitType],
	COUNT(1) AS [SplitCount]
FROM 
	fn_dblog (null, null)
WHERE 
	[Operation] = N'LOP_DELETE_SPLIT'
GROUP BY [AllocUnitName], [Context];
GO