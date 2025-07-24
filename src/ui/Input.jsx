import { motion } from "framer-motion";

const Input = ({ label, type = "text", value, onChange }) => {
  return (
    <div className="relative w-full max-w-md mx-auto">
      <motion.input
        id={label}
        whileFocus={{ scale: 1.02, boxShadow: "0 0 0 3px rgba(99,102,241,0.5)" }}
        transition={{ type: "spring", stiffness: 300 }}
        type={type}
        value={value}
        onChange={onChange}
        placeholder=" " // placeholder must be a single space for peer to work
        className="peer w-full px-4 pt-6 pb-2 rounded-2xl bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-300"
      />
      <motion.label
        htmlFor={label}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute left-4 text-sm text-gray-400 bg-gray-900 px-1 
                   transition-all duration-200 
                   peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base 
                   peer-placeholder-shown:text-gray-500
                   peer-focus:top-[-0.6rem] peer-focus:text-sm peer-focus:text-indigo-400"
      >
        {label}
      </motion.label>
    </div>
  );
};

export default Input;
