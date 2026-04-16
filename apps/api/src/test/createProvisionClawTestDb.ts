type TableName = 'claws' | 'pending_claws' | 'ssh_keys' | 'volumes'

type State = {
    existingClawsBySubscriptionId?: Record<string, any>
    pendingClawsById?: Record<string, any>
    sshKeysById?: Record<string, any>
    insertedClaws?: any[]
    deletedPendingClaws?: any[]
    deletedClaws?: any[]
    clawUpdates?: any[]
    insertedVolumes?: any[]
}

function getTableName(table: unknown): TableName {
    const symbols = Object.getOwnPropertySymbols(table as object)
    const nameSymbol = symbols.find((symbol) => String(symbol) === 'Symbol(drizzle:Name)')
    return (table as Record<symbol, TableName>)[nameSymbol as symbol]
}

function getEqRightValue(condition: any) {
    return condition?.queryChunks?.[3]?.value
}

export function createProvisionClawTestDb(seed: Partial<State> = {}) {
    const state: Required<State> = {
        existingClawsBySubscriptionId: seed.existingClawsBySubscriptionId || {},
        pendingClawsById: seed.pendingClawsById || {},
        sshKeysById: seed.sshKeysById || {},
        insertedClaws: [],
        deletedPendingClaws: [],
        deletedClaws: [],
        clawUpdates: [],
        insertedVolumes: []
    }

    const db = {
        state,

        select() {
            return {
                from(table: unknown) {
                    const tableName = getTableName(table)
                    return {
                        where(condition: any) {
                            const value = getEqRightValue(condition)
                            const rows =
                                tableName === 'claws'
                                    ? state.existingClawsBySubscriptionId[value]
                                        ? [state.existingClawsBySubscriptionId[value]]
                                        : []
                                    : tableName === 'ssh_keys'
                                      ? state.sshKeysById[value]
                                          ? [state.sshKeysById[value]]
                                          : []
                                      : []

                            return {
                                async limit(count: number) {
                                    return rows.slice(0, count)
                                }
                            }
                        }
                    }
                }
            }
        },

        delete(table: unknown) {
            const tableName = getTableName(table)
            return {
                where(condition: any) {
                    const value = getEqRightValue(condition)

                    if (tableName === 'pending_claws') {
                        const claimed = state.pendingClawsById[value]
                        if (claimed) {
                            delete state.pendingClawsById[value]
                            state.deletedPendingClaws.push(claimed)
                        }

                        return {
                            async returning() {
                                return claimed ? [claimed] : []
                            }
                        }
                    }

                    if (tableName === 'claws') {
                        state.deletedClaws.push(value)
                    }

                    return Promise.resolve()
                }
            }
        },

        insert(table: unknown) {
            const tableName = getTableName(table)
            return {
                async values(payload: any) {
                    if (tableName === 'claws') {
                        state.insertedClaws.push(payload)
                    }
                    if (tableName === 'volumes') {
                        state.insertedVolumes.push(payload)
                    }
                    return [payload]
                }
            }
        },

        update(table: unknown) {
            const tableName = getTableName(table)
            return {
                set(payload: any) {
                    return {
                        async where(condition: any) {
                            const value = getEqRightValue(condition)
                            if (tableName === 'claws') {
                                state.clawUpdates.push({ id: value, payload })
                            }
                            return []
                        }
                    }
                }
            }
        }
    }

    return db
}