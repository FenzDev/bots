export type ActionExecutor<TArgs, TId> = (
  args: TArgs,
) => Promise<TId | null> | TId | null;

export type ActionUndoer<TId> = (id: TId) => Promise<boolean> | boolean;

export function defineAction<TId, TArgs>({doAction,undoAction,display}: {
  doAction: ActionExecutor<TArgs, TId>;
  undoAction: ActionUndoer<TId>;
  display?: {title:string, description?:(args:TArgs)=>string},
}) {
  async function _doAction(args: TArgs): Promise<TId | null> {
    return await doAction(args);
  }

  async function _undoAction(id: TId): Promise<boolean> {
    return await undoAction(id);
  }

  return [_doAction, _undoAction] as const;
}
