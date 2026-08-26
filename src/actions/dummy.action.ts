import { defineAction } from "../utils/actions";

const [doDummy, undoDummy] = defineAction<number,void>({
  
  // this will show details of action
  display: {
    title: 'Dummy',
    description: (/** args */) => `Description of action`,
  },
  // to make the action untrackable
  // simply don't add display

  doAction: async (/** args */) => {
    // do stuff
    // return an identifier
    return 0;
  },
  undoAction: async (id) => {
    // with the identifier undo that stuff
    // then return true if undone successfully
    return id === 0;
  },
})

export {doDummy,undoDummy}