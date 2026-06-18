exec sp_updatestats

SELECT
	OBJECT_NAME ([ips].[object_id]) AS [Object Name],
	[si].[name] AS [Index Name],
	ROUND ([ips].[avg_fragmentation_in_percent], 2) AS [Fragmentation],
	[ips].[page_count] AS [Pages],
	ROUND ([ips].[avg_page_space_used_in_percent], 2) AS [Page Density]
FROM sys.dm_db_index_physical_stats (
	DB_ID (N'ConcordDb_v5'),
	NULL,
	NULL,
	NULL,
	N'DETAILED') [ips]
CROSS APPLY [sys].[indexes] [si]
WHERE
	[si].[object_id] = [ips].[object_id]
	AND [si].[index_id] = [ips].[index_id]
	AND [ips].[index_level] = 0 -- Just the leaf level
	AND [ips].[alloc_unit_type_desc] = N'IN_ROW_DATA'
ORDER BY [Fragmentation] DESC;
GO

--ALTER INDEX [IX_ProductProductGroup_ProductGroupID] ON [ProductProductGroup] REORGANIZE;
--GO

ALTER INDEX IX_Client_RegionID ON Client REBUILD
WITH (FILLFACTOR = 60);
GO

ALTER INDEX IX_Client_MainManagerID ON Client REBUILD
WITH (FILLFACTOR = 60);
GO

ALTER INDEX IX_ClientAgreement_NetUID ON ClientAgreement REBUILD
WITH (FILLFACTOR = 60);
GO

ALTER INDEX IX_Agreement_PricingID ON Agreement REBUILD
WITH (FILLFACTOR = 60);
GO