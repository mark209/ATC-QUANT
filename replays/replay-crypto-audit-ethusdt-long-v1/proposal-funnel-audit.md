# ETHUSDT Proposal Funnel Audit

Replay: crypto-audit-ethusdt-long-v1
Proposals: 3116

## Stage Funnel
### signal
Entering: 3116
Passing: 3116
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### evidence
Entering: 3116
Passing: 6
Rejected: 3110
Rejected percentage: 99.81%
Top reasons:
- 1794x Maximum realized volatility
- 1207x Maximum drawdown
- 109x Data quality
Representative examples:
- 4cb0e920-2211-4312-8e58-28b9944c2208 at 2017-10-22T00:00:00.000Z: Data quality
- 53274f77-3e92-45ff-8959-6245089ca815 at 2017-10-23T00:00:00.000Z: Data quality
- e8b136b1-3296-4e28-8344-8a20824250ac at 2017-10-24T00:00:00.000Z: Data quality

### risk
Entering: 6
Passing: 6
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### expected value
Entering: 6
Passing: 6
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### Kelly
Entering: 6
Passing: 6
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### proposal
Entering: 3116
Passing: 3116
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### order creation
Entering: 3116
Passing: 6
Rejected: 3110
Rejected percentage: 99.81%
Top reasons:
- 1794x Maximum realized volatility
- 1207x Maximum drawdown
- 109x Data quality
Representative examples:
- 4cb0e920-2211-4312-8e58-28b9944c2208 at 2017-10-22T00:00:00.000Z: Data quality
- 53274f77-3e92-45ff-8959-6245089ca815 at 2017-10-23T00:00:00.000Z: Data quality
- e8b136b1-3296-4e28-8344-8a20824250ac at 2017-10-24T00:00:00.000Z: Data quality

### execution
Entering: 6
Passing: 6
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

### completed trade
Entering: 6
Passing: 6
Rejected: 0
Rejected percentage: 0.00%
Top reasons:
Representative examples:

## Waterfall
| Stage | Count | Retained | Reduction |
|---|---:|---:|---:|
| proposals | 3116 | 100.00% | 0 |
| signal | 3116 | 100.00% | 0 |
| evidence | 6 | 0.19% | 3110 |
| risk | 6 | 0.19% | 0 |
| expected value | 6 | 0.19% | 0 |
| Kelly | 6 | 0.19% | 0 |
| proposal | 3116 | 100.00% | -3110 |
| order creation | 6 | 0.19% | 3110 |
| execution | 6 | 0.19% | 0 |
| completed trade | 6 | 0.19% | 0 |

Greatest reduction: **evidence (3110)**

## Trace/Lifecycle Mismatches
Mismatch count: 3116
| Proposal ID | Timestamp | First divergence | Trace | Lifecycle |
|---|---|---|---|---|
| fd1f1d58-1830-4d2c-8f20-b5360c2f19c0 | 2017-10-16T00:00:00.000Z | signal | reject | pass |
| 4cb0e920-2211-4312-8e58-28b9944c2208 | 2017-10-22T00:00:00.000Z | signal | reject | pass |
| 53274f77-3e92-45ff-8959-6245089ca815 | 2017-10-23T00:00:00.000Z | signal | reject | pass |
| e8b136b1-3296-4e28-8344-8a20824250ac | 2017-10-24T00:00:00.000Z | signal | reject | pass |
| e732257a-3861-4f9a-88ab-6e11b8ae3dd4 | 2017-10-25T00:00:00.000Z | signal | reject | pass |
| b0324ea0-469a-4649-83ce-88493208254d | 2017-10-26T00:00:00.000Z | signal | reject | pass |
| 8e1b5f9d-7e3f-4cc4-8bf8-03f76c463179 | 2017-10-27T00:00:00.000Z | signal | reject | pass |
| e059fc0b-c516-4111-8f04-a2e103e9e3c6 | 2017-10-28T00:00:00.000Z | signal | reject | pass |
| ff48320c-6bed-4fa1-8df3-175101ef1f53 | 2017-10-29T00:00:00.000Z | signal | reject | pass |
| 49ba4d20-4944-4610-8b78-176b3227f949 | 2017-10-30T00:00:00.000Z | signal | reject | pass |
| 3f747f38-0d1f-4bbe-8f55-4b21c4e2e16b | 2017-10-31T00:00:00.000Z | signal | reject | pass |
| 42f85569-721d-4e28-882d-34b30c3a11cb | 2017-11-01T00:00:00.000Z | signal | reject | pass |
| 8effedc1-939f-448c-8164-6d66d400f9ce | 2017-11-02T00:00:00.000Z | signal | reject | pass |
| f14337ef-cfa0-4cfe-8068-1ea5dd3f7cdb | 2017-11-03T00:00:00.000Z | signal | reject | pass |
| 49048acc-7e09-42cb-8026-4776d3226825 | 2017-11-04T00:00:00.000Z | signal | reject | pass |
| b4e2e9b3-d5d8-4f98-8760-75d353f4a3e0 | 2017-11-05T00:00:00.000Z | signal | reject | pass |
| f05848c4-fcbd-49cf-8613-01acb1103bde | 2017-11-06T00:00:00.000Z | signal | reject | pass |
| 1313d58a-dbf0-4900-8d45-a6e48e4b4e55 | 2017-11-07T00:00:00.000Z | signal | reject | pass |
| 9edd7176-8fbc-48bd-8852-7d3946b390e1 | 2017-11-08T00:00:00.000Z | signal | reject | pass |
| 89acb219-b498-4a5a-8acb-8789c9a00b3f | 2017-11-09T00:00:00.000Z | signal | reject | pass |
| 22ac03de-a6c3-4fe7-8454-85eac7cd3d85 | 2017-11-10T00:00:00.000Z | signal | reject | pass |
| a5e50bd4-f8fd-4d07-8912-819edf2fe747 | 2017-11-11T00:00:00.000Z | signal | reject | pass |
| fc39b01e-d5ec-416b-897e-11c3039674ea | 2017-11-12T00:00:00.000Z | signal | reject | pass |
| 8c02f716-0424-44ee-8944-937ec36907e0 | 2017-11-13T00:00:00.000Z | signal | reject | pass |
| 47cf7db0-feb6-427b-80c1-afcc251ad130 | 2017-11-14T00:00:00.000Z | signal | reject | pass |
| 3ff954eb-6d6b-4131-84d7-10edbb81e835 | 2018-01-17T00:00:00.000Z | proposal | reject | pass |
| b0225500-83ef-4f24-806d-cf21b8750f33 | 2018-01-18T00:00:00.000Z | proposal | reject | pass |
| cb1e850d-bfee-4de1-89c6-25e56b450178 | 2018-01-19T00:00:00.000Z | proposal | reject | pass |
| 9d8a6e99-78cf-46b7-8867-7c44936d9885 | 2018-01-20T00:00:00.000Z | proposal | reject | pass |
| 4829ff7c-5c9f-408a-8469-0913e396b856 | 2018-01-21T00:00:00.000Z | evidence | reject | pass |
| b25f18d9-43ee-43b8-8ab7-74e75c81534c | 2018-01-23T00:00:00.000Z | proposal | reject | pass |
| 62921839-6ffc-4441-8c2f-9a77ba0f72e8 | 2018-01-24T00:00:00.000Z | proposal | reject | pass |
| e734170e-293a-4f4d-848d-8f9bb251724a | 2018-01-25T00:00:00.000Z | evidence | reject | pass |
| a2d1ea26-a9c3-4fee-88c2-f3fabe67cba2 | 2018-02-03T00:00:00.000Z | signal | reject | pass |
| 9ed5008a-b3ac-44d3-87da-4d70628b671a | 2018-02-04T00:00:00.000Z | proposal | reject | pass |
| 0887884e-83cd-47c4-800a-da2a3f2a62f0 | 2018-02-05T00:00:00.000Z | signal | reject | pass |
| 99e4e311-39c1-46ac-82d7-4709431c0a53 | 2018-02-06T00:00:00.000Z | signal | reject | pass |
| 1c4f4b5d-8820-408c-8eeb-26c92f775ac7 | 2018-02-07T00:00:00.000Z | signal | reject | pass |
| e697175e-a4ff-4760-8b25-5dd478121e54 | 2018-02-08T00:00:00.000Z | signal | reject | pass |
| 291d1450-abdc-4e57-8959-f1b284538912 | 2018-02-09T00:00:00.000Z | signal | reject | pass |
| c270dd60-b246-4f60-8b96-9310b4d6215d | 2018-02-10T00:00:00.000Z | signal | reject | pass |
| e50da1f2-c3c3-4872-8ffe-9a63064e9a07 | 2018-02-11T00:00:00.000Z | signal | reject | pass |
| 1ccc31b7-7060-4f81-860b-f5a6324db102 | 2018-02-12T00:00:00.000Z | signal | reject | pass |
| b94779b1-baa6-42a5-832f-2cff19d393a6 | 2018-02-13T00:00:00.000Z | signal | reject | pass |
| a1fbf81a-352d-4b04-82f6-1985745caef6 | 2018-02-14T00:00:00.000Z | signal | reject | pass |
| caae7952-21b3-43af-80f1-c73854f2c44d | 2018-02-15T00:00:00.000Z | signal | reject | pass |
| 8d9e9fa9-7882-4841-88a4-9218653e1805 | 2018-02-16T00:00:00.000Z | signal | reject | pass |
| e16782db-dd69-4aa6-8154-b36f4d9d5daf | 2018-02-17T00:00:00.000Z | signal | reject | pass |
| 5f11dba9-f917-496e-8acc-7f5326b30811 | 2018-02-18T00:00:00.000Z | signal | reject | pass |
| 88047f40-754c-44da-8c5f-c01c7241e574 | 2018-02-19T00:00:00.000Z | signal | reject | pass |
| 0cb57ca2-5b02-480b-82a4-7b37cc11983f | 2018-02-20T00:00:00.000Z | signal | reject | pass |
| 7649fcaa-bf98-41a6-8b59-c966c96a3c83 | 2018-02-21T00:00:00.000Z | signal | reject | pass |
| 1d44ff69-6285-4355-822e-ac6eddee5cbc | 2018-02-22T00:00:00.000Z | signal | reject | pass |
| a4bbccad-8f85-4e8b-8405-3a27c67603b3 | 2018-02-23T00:00:00.000Z | signal | reject | pass |
| ceefb8d3-be02-4c8c-8c1f-1abab88d53c9 | 2018-02-24T00:00:00.000Z | signal | reject | pass |
| c78cb32d-55f1-4627-8395-c3f374647a2c | 2018-02-25T00:00:00.000Z | signal | reject | pass |
| fafcc427-0548-407b-8ef6-4b408c498969 | 2018-02-26T00:00:00.000Z | signal | reject | pass |
| 42f99cc4-b1f5-4ea8-86f5-7a367af5da48 | 2018-02-27T00:00:00.000Z | signal | reject | pass |
| 2cccee39-692b-427f-8530-3e0f53b2a2b7 | 2018-02-28T00:00:00.000Z | signal | reject | pass |
| 7d4df36d-74d7-4774-86fe-0a2746808c46 | 2018-03-01T00:00:00.000Z | signal | reject | pass |
| eca914b2-cb42-43d5-8786-3dbc776a5169 | 2018-03-02T00:00:00.000Z | signal | reject | pass |
| cbc8eff1-0099-4a69-8057-25b8f47cdd4e | 2018-03-03T00:00:00.000Z | signal | reject | pass |
| 845bfdad-2473-4cb5-858f-0e0ffe1de841 | 2018-03-04T00:00:00.000Z | signal | reject | pass |
| 91a27e79-a315-464c-8520-656fb4b108ca | 2018-03-05T00:00:00.000Z | proposal | reject | pass |
| 56c2c4d0-181f-438e-8d02-f0240115d576 | 2018-03-06T00:00:00.000Z | proposal | reject | pass |
| 64afd6e0-97e2-48e6-83fa-9306fa19759d | 2018-03-07T00:00:00.000Z | proposal | reject | pass |
| a14ab152-3792-47de-8f14-1db0ea025690 | 2018-03-08T00:00:00.000Z | proposal | reject | pass |
| 7c9cc2ca-5b9b-492a-8038-cba629c06e8b | 2018-03-09T00:00:00.000Z | proposal | reject | pass |
| dac3461a-63f9-46e2-8e37-608839a24996 | 2018-03-10T00:00:00.000Z | proposal | reject | pass |
| efdacb6d-9ff4-4f8f-8cfc-2f191c37af3b | 2018-03-11T00:00:00.000Z | proposal | reject | pass |
| 266ca491-4e8d-429d-812f-31a23a4fa4a0 | 2018-03-12T00:00:00.000Z | proposal | reject | pass |
| c82e5a73-1f9d-49c2-8cec-783d07d56e38 | 2018-03-13T00:00:00.000Z | proposal | reject | pass |
| c6c60e62-5972-42b1-8d64-e58e0f3d9664 | 2018-03-14T00:00:00.000Z | proposal | reject | pass |
| acdfa4a9-aa7d-4632-8c10-4213976c56b9 | 2018-03-15T00:00:00.000Z | proposal | reject | pass |
| 784f3f21-9b2c-4943-8334-31897e214bba | 2018-03-16T00:00:00.000Z | proposal | reject | pass |
| 14fc3991-fd20-4e43-88df-f16c66f20358 | 2018-03-17T00:00:00.000Z | proposal | reject | pass |
| 9cbb0b22-6bfe-4002-8b56-1a41834f4bfe | 2018-03-18T00:00:00.000Z | signal | reject | pass |
| cfd4bf7b-ec32-4ec4-8da8-fa6238f8e825 | 2018-03-19T00:00:00.000Z | signal | reject | pass |
| e8bb327f-5e13-4492-8aba-679350d172fe | 2018-03-20T00:00:00.000Z | signal | reject | pass |
| 01e45667-faac-4b14-8051-7386282e44aa | 2018-03-21T00:00:00.000Z | signal | reject | pass |
| 0df818fa-5d01-4e4e-8c85-49e554b82a84 | 2018-03-22T00:00:00.000Z | signal | reject | pass |
| 277d2203-166d-4d0e-8898-91fb2d97ece3 | 2018-03-23T00:00:00.000Z | signal | reject | pass |
| 5f9fa2cc-e2fa-4624-8bcc-41cb08ec9ccf | 2018-03-24T00:00:00.000Z | signal | reject | pass |
| e70eacb1-7b72-4b93-85f5-8f7dce245095 | 2018-03-25T00:00:00.000Z | signal | reject | pass |
| ec9cfe9f-d788-4665-8d3c-4c0ecee38ecc | 2018-03-26T00:00:00.000Z | signal | reject | pass |
| 3e7d3319-3d3c-41ec-8be7-dc704ef2757d | 2018-03-27T00:00:00.000Z | signal | reject | pass |
| e30a4c86-780e-441e-8abf-c6a172babb56 | 2018-03-28T00:00:00.000Z | signal | reject | pass |
| f177337a-5eef-44a6-85c1-4f330d325270 | 2018-03-29T00:00:00.000Z | signal | reject | pass |
| bcd1cde9-b5b3-488d-88e2-4e2dcc1b9c9c | 2018-03-30T00:00:00.000Z | signal | reject | pass |
| 5a515a56-3bc2-4f6a-8cb3-069b3a7cbaad | 2018-03-31T00:00:00.000Z | signal | reject | pass |
| 9c82c8ba-17a2-4216-82c3-9d9aca4346dd | 2018-04-01T00:00:00.000Z | signal | reject | pass |
| a14c6f5c-3719-4e08-8170-3d5bb2419382 | 2018-04-02T00:00:00.000Z | signal | reject | pass |
| 1d2edf13-7875-4902-83d0-d46693f254ee | 2018-04-03T00:00:00.000Z | signal | reject | pass |
| d8b7aa51-c3a4-43d8-8611-81ed27f3f10b | 2018-04-04T00:00:00.000Z | signal | reject | pass |
| cda5c7ba-9f6d-4ee6-8d0f-202db2b380f3 | 2018-04-05T00:00:00.000Z | signal | reject | pass |
| 29a7d2dd-1b27-45f0-8e9a-4ecf0631793b | 2018-04-06T00:00:00.000Z | signal | reject | pass |
| 369760fa-a0e9-4f83-82cd-19ef96f36dac | 2018-04-07T00:00:00.000Z | signal | reject | pass |
| a8f6c0a5-f599-45d7-82c2-cf1782012ae6 | 2018-04-08T00:00:00.000Z | signal | reject | pass |
| 29082092-4286-44bd-8bbf-2dc900243e0d | 2018-04-09T00:00:00.000Z | signal | reject | pass |
| f7d9b882-43cd-47f3-868e-c74cbd2bc059 | 2018-04-10T00:00:00.000Z | signal | reject | pass |

Lifecycle stages not separately emitted: evidence, expected value, Kelly

## Conclusion
The greatest observed reduction is at evidence (3110 proposals). 3116 of 3116 proposals diverge between trace and lifecycle stage outcomes.
